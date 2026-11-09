//! The insurance desk's rows on the leakage inbox (revenue integrity RFC 1.3, 1.4).
//!
//! Pre-auths nearly used up and rooms above the policy limit. Same table as the charge queue (`charge_attention_items`), its own
//! kinds, each seen and worked under its own permission; a row of a kind the
//! caller may not see answers 404, as if absent.
//!
//! The rows are raised elsewhere: `preauth_used_up` (and, for an insured
//! inpatient with no usable pre-auth, `preauth_missing_or_expired`) by the
//! invoice trigger and the hourly sweep (migration 1423, `preauth_sweep`),
//! `room_over_limit` by the IPD allocation
//! (`medbrains_server_services::room_eligibility`). Here the desk lists them
//! and acts: request an enhancement, record the family's room consent, or
//! dismiss a "no usable pre-auth" row with a reason (`dismiss`).

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
use medbrains_server_core::{
    error::AppError,
    middleware::auth::Claims,
    pagination::{Paginated, Pagination},
    state::AppState,
};
use medbrains_server_services::room_eligibility::{
    RoomConsentInput, consent_on_row, linked_charges_sql, mark_actioned, payable_ratio_sql,
};

/// Pre-auth nearly used up (or its approval unreadable).
pub const KIND_PREAUTH: &str = "preauth_used_up";
/// Room above the policy's room rent limit.
pub const KIND_ROOM: &str = "room_over_limit";
/// Rows one list returns, largest first; `meta.total` says how many there are.
const LIST_LIMIT: i64 = 200;
/// A pre-auth row's reason when its approval was read and is nearly used:
/// the only one an enhancement can be asked on.
const REASON_USED_UP: &str = "preauth_used_up";

/// One inbox row of an insurance kind, with the patient and payer joined.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RevenueAlert {
    pub id: Uuid,
    pub kind: String,
    /// `preauth_used_up`, `preauth_approval_unknown`,
    /// `preauth_missing_or_expired`, `room_over_limit` or
    /// `room_eligibility_unknown`: the unknowns are faults, never "fine".
    pub reason: String,
    pub status: String,
    /// The pre-auth (`prior_auth_requests`) or, for a room row or a visit
    /// with no usable pre-auth, the admission.
    pub source_entity_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub patient_name: String,
    pub uhid: String,
    pub payer: Option<String>,
    pub pa_number: Option<String>,
    /// The pre-auth's approved amount now (not as it was when the row was
    /// raised), so an enhancement is asked on top of the live approval.
    pub approved_amount: Option<Decimal>,
    /// The extra amount already asked for, if an enhancement is pending.
    pub enhancement_amount: Option<Decimal>,
    /// Rupees at stake: the running bill, or the expected cut (an open room
    /// row's is worked out from the visit's bills when the list is read).
    pub amount: Option<Decimal>,
    /// The numbers behind the row (approved amount, room rate, ratio, ...).
    pub evidence: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolved_by_name: Option<String>,
}

/// The row's columns with the patient and payer joined. An open room row's
/// amount is its cut on the visit's room-linked charges now (the cut stored
/// at allocation is often ₹0), worked out here so a list ranks and limits by
/// it, with the bill it is worked on in the evidence. A ratio that is not a
/// plain decimal leaves the row at its stored amount.
fn alert_select() -> String {
    format!(
        "SELECT a.id, a.kind, a.reason, a.status, a.source_entity_id, \
            a.patient_id, a.encounter_id, \
            btrim(concat_ws(' ', p.first_name, p.last_name)) AS patient_name, p.uhid, \
            pi.insurance_provider AS payer, pa.pa_number, pa.approved_amount, \
            pa.enhancement_amount, \
            COALESCE(round(lc.bill * (1 - lc.ratio), 2), a.amount) AS amount, \
            CASE WHEN lc.bill IS NULL THEN a.evidence \
                 ELSE a.evidence || jsonb_build_object('estimated_bill', lc.bill) END \
              AS evidence, \
            a.created_at, a.resolved_at, ru.full_name AS resolved_by_name \
       FROM charge_attention_items a \
       JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
       LEFT JOIN prior_auth_requests pa \
         ON a.source_module = 'prior_auth' AND pa.id = a.source_entity_id \
        AND pa.tenant_id = a.tenant_id \
       LEFT JOIN patient_insurance pi ON pi.tenant_id = a.tenant_id \
         AND pi.id = COALESCE(pa.patient_insurance_id, (a.evidence->>'patient_insurance_id')::uuid) \
       LEFT JOIN LATERAL (SELECT {} AS bill, r.ratio \
                            FROM (SELECT {} AS ratio) r \
                           WHERE a.status = 'open' AND a.reason = '{KIND_ROOM}' \
                             AND a.encounter_id IS NOT NULL AND r.ratio IS NOT NULL) lc ON true \
       LEFT JOIN users ru ON ru.id = a.resolved_by",
        linked_charges_sql("a.tenant_id", "a.encounter_id"),
        payable_ratio_sql("a.evidence")
    )
}

/// The permission that lets the caller see (`act` false) or work a kind;
/// an unknown kind is a 400.
pub(crate) fn kind_permission(kind: &str, act: bool) -> Result<&'static str, AppError> {
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

/// `GET /api/billing/revenue-alerts?kind=` — the kind's rows, largest first.
///
/// Then oldest. At most [`LIST_LIMIT`] rows, with `meta.total` the count of
/// every matching row, so a cut list says so. Amounts (and the approval
/// behind them) are hidden from a caller who may not see them, as on the
/// charge queue, and that caller's list is oldest first, so its order does
/// not give the amounts away.
///
/// # Errors
/// 403 without the kind's view permission; 400 for an unknown kind.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn list_revenue_alerts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListRevenueAlertsQuery>,
) -> Result<Json<Paginated<RevenueAlert>>, AppError> {
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
    // `amount` here is the output column: an open room row's live cut.
    let order = if hide_amounts {
        "a.created_at"
    } else {
        "amount DESC NULLS LAST, a.created_at"
    };
    let filter = "a.tenant_id = $1 AND a.kind = $2 AND a.deleted_at IS NULL \
           AND ($3::text IS NULL OR a.status = $3) \
           AND ($4::uuid[] IS NULL OR a.patient_id = ANY($4))";
    let total: i64 = sqlx::query_scalar(&format!(
        "SELECT count(*) FROM charge_attention_items a WHERE {filter}"
    ))
    .bind(claims.tenant_id)
    .bind(&q.kind)
    .bind(status)
    .bind(&visible)
    .fetch_one(&mut *tx)
    .await?;
    let mut rows = sqlx::query_as::<_, RevenueAlert>(&format!(
        "{} WHERE {filter} ORDER BY {order} LIMIT {LIST_LIMIT}",
        alert_select()
    ))
    .bind(claims.tenant_id)
    .bind(&q.kind)
    .bind(status)
    .bind(&visible)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    if hide_amounts {
        hide(&mut rows);
    }
    let page = Pagination {
        page: None,
        limit: Some(LIST_LIMIT),
    };
    Ok(Json(Paginated::new(rows, total, &page)))
}

/// Blank every figure on the rows: the amount, the numbers behind it, and
/// the pre-auth's approval and enhancement, which give the bill away.
fn hide(rows: &mut [RevenueAlert]) {
    for row in rows {
        row.amount = None;
        row.evidence = None;
        row.approved_amount = None;
        row.enhancement_amount = None;
    }
}

/// The open row of `kind`, locked for this decision, once the caller has
/// billing access to its patient: 404 if missing or of another kind, 409 once
/// acted on. Returns the row's reason and subject.
pub(crate) async fn lock_open(
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

/// One row by id, as the list shows it: the figures hidden when `hidden`.
pub(crate) async fn fetch(
    conn: &mut PgConnection,
    (tenant_id, id): (Uuid, Uuid),
    hidden: bool,
) -> Result<RevenueAlert, AppError> {
    let mut row = sqlx::query_as::<_, RevenueAlert>(&format!(
        "{} WHERE a.id = $1 AND a.tenant_id = $2",
        alert_select()
    ))
    .bind(id)
    .bind(tenant_id)
    .fetch_one(conn)
    .await?;
    if hidden {
        hide(std::slice::from_mut(&mut row));
    }
    Ok(row)
}

#[derive(Debug, Deserialize)]
pub struct RequestEnhancementBody {
    /// How much more to ask the payer for, in rupees.
    pub additional_amount: Decimal,
    pub note: Option<String>,
}

/// `PUT /api/billing/revenue-alerts/{id}/request-enhancement` — ask for more.
///
/// For a pre-auth nearly used up; 409 on a row whose approval could not be
/// read or whose visit has no usable pre-auth. The pre-auth becomes an `enhancement`
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
    let (reason, prior_auth) = lock_open(&mut tx, (&state, &claims), KIND_PREAUTH, id).await?;
    if reason != REASON_USED_UP {
        return Err(AppError::Conflict(
            "billing.revenueAlerts.noApprovalToEnhance".to_owned(),
        ));
    }
    let extra = body.additional_amount.round_dp(2);
    let total = mark_enhancement(&mut tx, &claims, prior_auth, extra).await?;
    let what = serde_json::json!({ "enhancement": {
        "additional_amount": extra,
        "requested_total": total,
        "note": note,
    }});
    mark_actioned(&mut tx, claims.tenant_id, claims.sub, id, what).await?;
    let hidden = crate::amounts_hidden(&state, &claims).await?;
    let row = fetch(&mut tx, (claims.tenant_id, id), hidden).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Mark the pre-auth as asking for `extra` more and return the total asked
/// (the live approval plus `extra`). The original estimate is left as it was.
/// 409 unless the pre-auth is approved (fully or in part) and has no
/// enhancement waiting on the payer, i.e. none asked since its last answer.
async fn mark_enhancement(
    conn: &mut PgConnection,
    claims: &Claims,
    prior_auth: Uuid,
    extra: Decimal,
) -> Result<Decimal, AppError> {
    sqlx::query_scalar::<_, Decimal>(
        "UPDATE prior_auth_requests SET request_stage = 'enhancement', \
                enhancement_amount = $3, enhancement_requested_at = now(), \
                enhancement_requested_by = $4, updated_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
            AND status IN ('approved', 'partially_approved') \
            AND NOT (request_stage = 'enhancement' AND enhancement_requested_at IS NOT NULL \
                     AND enhancement_requested_at > COALESCE(responded_at, '-infinity')) \
          RETURNING COALESCE(approved_amount, 0) + enhancement_amount",
    )
    .bind(prior_auth)
    .bind(claims.tenant_id)
    .bind(extra)
    .bind(claims.sub)
    .fetch_optional(conn)
    .await?
    .ok_or_else(|| AppError::Conflict("billing.revenueAlerts.enhancementNotOpen".to_owned()))
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
    consent_on_row(&mut tx, (claims.tenant_id, claims.sub), id, &body).await?;
    let hidden = crate::amounts_hidden(&state, &claims).await?;
    let row = fetch(&mut tx, (claims.tenant_id, id), hidden).await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used)]

    use super::{RevenueAlert, hide};
    use chrono::Utc;
    use rust_decimal::Decimal;
    use uuid::Uuid;

    #[test]
    fn hidden_amounts_hide_the_approval_and_enhancement_too() {
        let mut rows = [RevenueAlert {
            id: Uuid::nil(),
            kind: "preauth_used_up".to_owned(),
            reason: "preauth_used_up".to_owned(),
            status: "open".to_owned(),
            source_entity_id: Uuid::nil(),
            patient_id: Uuid::nil(),
            encounter_id: None,
            patient_name: "A".to_owned(),
            uhid: "U".to_owned(),
            payer: None,
            pa_number: None,
            approved_amount: Some(Decimal::from(100_000)),
            enhancement_amount: Some(Decimal::from(50_000)),
            amount: Some(Decimal::from(85_000)),
            evidence: Some(serde_json::json!({ "running_bill": 85_000 })),
            created_at: Utc::now(),
            resolved_at: None,
            resolved_by_name: None,
        }];
        hide(&mut rows);
        let r = &rows[0];
        assert_eq!(
            (r.amount, r.approved_amount, r.enhancement_amount),
            (None, None, None)
        );
        assert!(r.evidence.is_none());
    }
}

//! A card sale whose outcome nobody knows — the machine gave no definite
//! answer in time, or refused the cancel because the PIN was already in —
//! settled by a supervisor with the machine's slip in hand.
//!
//! Paid needs the slip's RRN or approval code, and posts through the same
//! exactly-once settle as a machine approval, so a real approval that lands
//! before or after posts nothing more. Not paid needs a reason. Either way
//! it is audited.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::payment::PaymentGatewayTransaction;
use medbrains_core::permissions;
use medbrains_db::audit::{AuditEntry, AuditLogger};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use super::sale::{apply_in, begin, is_unknown, load_sale, refresh, require_collect};
use super::view::{PosSaleView, view};
use super::{Approval, Step};
use crate::settle::lock_txn;

/// `error_code` of a sale a supervisor checked and found not paid.
pub const NOT_TAKEN: &str = "checked_not_taken";
/// Longest RRN / approval code taken (an RRN is 12 digits; codes are shorter).
const MAX_REFERENCE: usize = 64;
const MAX_REASON: usize = 500;
/// Unresolved card sales one bill shows at once.
const MAX_UNRESOLVED: i64 = 10;

#[derive(Debug, Deserialize)]
pub struct ResolveSale {
    /// `paid` — the slip shows it approved; `not_paid` — it does not.
    pub outcome: String,
    pub rrn: Option<String>,
    pub approval_code: Option<String>,
    /// `card` or `upi`, as the slip shows; else what the cashier asked for.
    pub method: Option<String>,
    pub reason: Option<String>,
}

fn clean(v: Option<&str>, max: usize, what: &str) -> Result<Option<String>, AppError> {
    match v.map(str::trim).filter(|s| !s.is_empty()) {
        Some(s) if s.chars().count() > max => Err(AppError::BadRequest(format!(
            "The {what} is longer than {max} characters"
        ))),
        other => Ok(other.map(ToOwned::to_owned)),
    }
}

/// What the supervisor's answer does to the sale.
pub fn step_for(body: &ResolveSale) -> Result<Step, AppError> {
    match body.outcome.as_str() {
        "paid" => {
            let rrn = clean(body.rrn.as_deref(), MAX_REFERENCE, "RRN")?;
            let code = clean(
                body.approval_code.as_deref(),
                MAX_REFERENCE,
                "approval code",
            )?;
            let reference = rrn.clone().or_else(|| code.clone()).ok_or_else(|| {
                AppError::BadRequest(
                    "Type the RRN or the approval code printed on the machine's slip".to_owned(),
                )
            })?;
            let method = match clean(body.method.as_deref(), MAX_REFERENCE, "method")? {
                Some(m) if m == "card" || m == "upi" => Some(m),
                Some(m) => {
                    return Err(AppError::BadRequest(format!("'{m}' is not card or upi")));
                }
                None => None,
            };
            Ok(Step::Settle(Approval {
                reference,
                auth_code: code,
                rrn,
                method,
                payload: json!({ "resolved_from_slip": true }),
                ..Approval::default()
            }))
        }
        "not_paid" => {
            let why = clean(body.reason.as_deref(), MAX_REASON, "reason")?.ok_or_else(|| {
                AppError::BadRequest(
                    "Say what the machine's slip or report shows — no money taken because…"
                        .to_owned(),
                )
            })?;
            Ok(Step::Fail {
                code: NOT_TAKEN,
                why,
            })
        }
        other => Err(AppError::BadRequest(format!(
            "'{other}' is not an outcome — paid or not_paid"
        ))),
    }
}

/// Unknown, or still on the machine after a refused cancel.
fn resolvable(txn: &PaymentGatewayTransaction) -> bool {
    is_unknown(txn) || (txn.status == "created" && txn.notes["cancel_refused"] == Value::Bool(true))
}

/// `POST /api/payments/pos-sale/{id}/resolve` — a supervisor records what the
/// machine's slip shows for a sale with no definite outcome.
pub async fn resolve_sale(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ResolveSale>,
) -> Result<Json<PosSaleView>, AppError> {
    require_permission(&claims, permissions::billing::payments::RECONCILE)?;
    let (txn, _) = load_sale(&state.db, claims.tenant_id, id).await?;
    crate::require_invoice_billing(&state, &claims, txn.invoice_id).await?;
    let step = step_for(&body)?;
    let mut tx = begin(&state.db, claims.tenant_id).await?;
    let before = lock_txn(&mut tx, id).await?;
    if !resolvable(&before) {
        return Err(AppError::Conflict(
            "This card payment already has an outcome — there is nothing to resolve".to_owned(),
        ));
    }
    apply_in(&mut tx, id, step).await?;
    let old = json!({ "status": before.status, "error_code": before.error_code });
    let new = json!({ "outcome": body.outcome, "rrn": body.rrn,
                      "approval_code": body.approval_code, "method": body.method,
                      "reason": body.reason });
    AuditLogger::log(
        &mut tx,
        &AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "pos_sale.resolve",
            entity_type: "payment_gateway_transaction",
            entity_id: Some(id),
            old_values: Some(&old),
            new_values: Some(&new),
            ip_address: None,
        },
    )
    .await?;
    tx.commit().await?;
    view(&state.db, claims.tenant_id, id).await.map(Json)
}

#[derive(Debug, Deserialize)]
pub struct UnresolvedQuery {
    pub invoice_id: Uuid,
}

/// `GET /api/payments/pos-sales/unresolved?invoice_id=` — the bill's card
/// sales nobody knows the outcome of, asked of the machine once more, so the
/// counter shows them (after a reload, or to the supervisor who comes over)
/// instead of letting the card be charged again.
pub async fn list_unresolved(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<UnresolvedQuery>,
) -> Result<Json<Vec<PosSaleView>>, AppError> {
    require_collect(&state, &claims, Some(q.invoice_id)).await?;
    let mut tx = begin(&state.db, claims.tenant_id).await?;
    let ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM payment_gateway_transactions \
          WHERE tenant_id = $1 AND invoice_id = $2 AND terminal_id IS NOT NULL \
            AND ((status = 'failed' AND error_code = 'unknown') \
                 OR (status = 'created' AND notes->>'cancel_refused' = 'true')) \
          ORDER BY created_at DESC LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(q.invoice_id)
    .bind(MAX_UNRESOLVED)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    // ponytail: one machine ask + one read per sale, bounded by MAX_UNRESOLVED
    // (in practice 0–1 per bill); batch the reads if that ever grows.
    let mut views = Vec::with_capacity(ids.len());
    for id in ids {
        refresh(&state, claims.tenant_id, id).await?;
        let v = view(&state.db, claims.tenant_id, id).await?;
        if matches!(v.stage, "unknown" | "cancel_refused") {
            views.push(v);
        }
    }
    Ok(Json(views))
}

#[cfg(test)]
mod tests {
    use super::{NOT_TAKEN, ResolveSale, Step, step_for};

    fn body(outcome: &str) -> ResolveSale {
        ResolveSale {
            outcome: outcome.to_owned(),
            rrn: None,
            approval_code: None,
            method: None,
            reason: None,
        }
    }

    #[test]
    fn paid_needs_the_slips_rrn_or_approval_code() {
        assert!(step_for(&body("paid")).is_err());
        let blank = ResolveSale {
            rrn: Some("  ".to_owned()),
            ..body("paid")
        };
        assert!(step_for(&blank).is_err());
        let with_rrn = ResolveSale {
            rrn: Some(" 429011223344 ".to_owned()),
            method: Some("upi".to_owned()),
            ..body("paid")
        };
        let Ok(Step::Settle(a)) = step_for(&with_rrn) else {
            unreachable!("settles")
        };
        assert_eq!(
            (a.reference.as_str(), a.rrn.as_deref(), a.method.as_deref()),
            ("429011223344", Some("429011223344"), Some("upi"))
        );
        let bad_mode = ResolveSale {
            approval_code: Some("A1".to_owned()),
            method: Some("cash".to_owned()),
            ..body("paid")
        };
        assert!(step_for(&bad_mode).is_err());
    }

    #[test]
    fn not_paid_needs_a_reason_and_anything_else_is_refused() {
        assert!(step_for(&body("not_paid")).is_err());
        let checked = ResolveSale {
            reason: Some("Slip shows CANCELLED".to_owned()),
            ..body("not_paid")
        };
        assert!(matches!(step_for(&checked), Ok(Step::Fail { code, .. }) if code == NOT_TAKEN));
        assert!(step_for(&body("maybe")).is_err());
    }
}

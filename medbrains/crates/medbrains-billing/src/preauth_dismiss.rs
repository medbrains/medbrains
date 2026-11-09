//! Dismiss a "no usable pre-auth" row (revenue integrity RFC 1.3).
//!
//! An insured inpatient with no usable pre-auth is raised so the desk gets
//! one before the bill grows. Sometimes none is coming, and rightly: the
//! family chose to pay cash, or the treatment is not covered by the policy.
//! The desk dismisses the row with that reason, on the audit chain; the
//! check does not raise it again for that admission, unless a pre-auth is
//! created for the patient after the dismissal.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use serde::Deserialize;
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_kernel::{Actor, require_permission};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};

use crate::revenue_alerts::{KIND_PREAUTH, RevenueAlert, fetch, lock_open};

/// The only reason a dismissal is accepted on.
const REASON_MISSING: &str = "preauth_missing_or_expired";
/// Why no pre-auth is needed: the patient pays cash, the treatment is not
/// covered, or another reason the note gives.
const DISMISS_REASONS: &[&str] = &["self_pay", "not_covered", "other"];
/// The longest note kept with a dismissal.
const MAX_NOTE_CHARS: usize = 500;

#[derive(Debug, Deserialize)]
pub struct DismissPreauthBody {
    /// One of `self_pay`, `not_covered`, `other`.
    pub reason: String,
    /// Required for `other`.
    pub note: Option<String>,
}

/// The reason and trimmed note, or 400: an unknown reason, `other` without
/// a note, or a note over 500 characters.
fn validated(body: &DismissPreauthBody) -> Result<(&str, Option<&str>), AppError> {
    let note = body
        .note
        .as_deref()
        .map(str::trim)
        .filter(|n| !n.is_empty());
    let bad = |code: &str| {
        Err(AppError::BadRequest(format!(
            "billing.revenueAlerts.{code}"
        )))
    };
    if !DISMISS_REASONS.contains(&body.reason.as_str()) {
        return bad("dismissReasonRequired");
    }
    if body.reason == "other" && note.is_none() {
        return bad("dismissNoteRequired");
    }
    if note.is_some_and(|n| n.chars().count() > MAX_NOTE_CHARS) {
        return bad("noteTooLong");
    }
    Ok((body.reason.as_str(), note))
}

/// `PUT /api/billing/revenue-alerts/{id}/dismiss` — no pre-auth is needed.
///
/// For a "no usable pre-auth" row only; any other pre-auth row is 409 (an
/// approval nearly used up is answered by an enhancement, not a dismissal).
///
/// # Errors
/// 403 without `insurance.preauth_missing.dismiss` or billing access to
/// the patient; 400 as [`validated`]; 404 / 409 as `lock_open`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn dismiss_preauth_alert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DismissPreauthBody>,
) -> Result<Json<RevenueAlert>, AppError> {
    require_permission(&claims, permissions::insurance::preauth_missing::DISMISS)?;
    let (reason, note) = validated(&body)?;
    let hidden = crate::amounts_hidden(&state, &claims).await?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let (row_reason, admission) = lock_open(&mut tx, (&state, &claims), KIND_PREAUTH, id).await?;
    if row_reason != REASON_MISSING {
        return Err(AppError::Conflict(
            "billing.revenueAlerts.notDismissable".to_owned(),
        ));
    }
    let what = serde_json::json!({ "dismissal": { "reason": reason, "note": note } });
    sqlx::query(
        "UPDATE charge_attention_items SET status = 'dismissed', dismiss_reason = $3, \
                resolved_by = $4, resolved_at = now(), \
                evidence = COALESCE(evidence, '{}'::jsonb) || $5, updated_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND status = 'open'",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(reason)
    .bind(claims.sub)
    .bind(&what)
    .execute(&mut *tx)
    .await?;
    let detail = serde_json::json!({ "admission_id": admission, "reason": reason, "note": note });
    medbrains_kernel::audit(
        &mut tx,
        &medbrains_kernel::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "insurance.preauth_missing.dismiss",
            entity_type: "charge_attention_items",
            entity_id: Some(id),
            old_values: None,
            new_values: Some(&detail),
            ip_address: None,
        },
    )
    .await?;
    let row = fetch(&mut tx, (claims.tenant_id, id), hidden).await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[cfg(test)]
mod tests {
    use super::{DismissPreauthBody, validated};

    fn body(reason: &str, note: Option<&str>) -> DismissPreauthBody {
        DismissPreauthBody {
            reason: reason.to_owned(),
            note: note.map(ToOwned::to_owned),
        }
    }

    #[test]
    fn a_dismissal_needs_a_known_reason_and_other_needs_a_note() {
        assert!(validated(&body("self_pay", None)).is_ok());
        assert!(validated(&body("not_covered", Some("  "))).is_ok());
        assert!(validated(&body("cash", None)).is_err());
        assert!(validated(&body("other", Some("   "))).is_err());
        assert!(validated(&body("other", Some("Corporate pays directly"))).is_ok());
        assert!(validated(&body("other", Some(&"x".repeat(501)))).is_err());
    }
}

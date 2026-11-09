//! The hospital's pre-auth alert threshold (revenue integrity RFC 1.3).
//!
//! The share of a pre-auth's approval at which the insurance desk is warned
//! (`tenant_settings` `preauth_alerts` / `threshold_percent`, read by the
//! invoice trigger's `preauth_alert_threshold`, migration 1423). It has its
//! own permission and this endpoint, which refuses anything but a whole
//! number from 1 to 100; the generic settings API refuses the category
//! (`settings_guard`), so nothing else can store a value the check cannot use.

use axum::{Extension, Json, extract::State};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use medbrains_core::permissions;
use medbrains_kernel::audit::AuditEntry;
use medbrains_kernel::{Actor, Claims, Tx, audit, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;

/// The settings category, managed only here.
const CATEGORY: &str = "preauth_alerts";
/// The key of the threshold.
const KEY: &str = "threshold_percent";
/// The share warned at when the hospital has set none (as the SQL check).
const DEFAULT_PERCENT: i64 = 80;

/// What the billing screen shows.
#[derive(Debug, Serialize, PartialEq)]
pub struct PreauthAlertSettings {
    /// The saved threshold; `None` when unset or unreadable.
    pub threshold_percent: Option<f64>,
    /// The share used while none is saved, or while the saved one is unreadable.
    pub default_percent: i64,
    /// A value is stored that is not a number from 1 to 100: the check warns
    /// at the default and marks each row `threshold_invalid` until it is saved again.
    pub invalid: bool,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdatePreauthAlertSettings {
    pub threshold_percent: i64,
}

/// The stored value as the SQL check reads it: unset, a number from 1 to
/// 100 (a number or a numeric string), or invalid.
fn read_threshold(stored: Option<&Value>) -> PreauthAlertSettings {
    let mut out = PreauthAlertSettings {
        threshold_percent: None,
        default_percent: DEFAULT_PERCENT,
        invalid: false,
    };
    let parsed = match stored {
        None | Some(Value::Null) => return out,
        Some(Value::Number(n)) => n.as_f64(),
        Some(Value::String(s)) => s
            .bytes()
            .all(|b| b.is_ascii_digit() || b == b'.')
            .then(|| s.parse::<f64>().ok())
            .flatten(),
        Some(_) => None,
    };
    match parsed.filter(|p| (1.0..=100.0).contains(p)) {
        Some(p) => out.threshold_percent = Some(p),
        None => out.invalid = true,
    }
    out
}

/// The threshold as stored in the unit of work's tenant.
async fn current(tx: &mut Tx) -> Result<PreauthAlertSettings, AppError> {
    let tenant = tx.actor().tenant_id;
    let stored = medbrains_kernel::config::setting_in(tx, &tenant, CATEGORY, KEY).await?;
    Ok(read_threshold(stored.as_ref()))
}

/// `GET /api/billing/preauth-alert-settings` — the saved threshold, and
/// whether what is stored is unreadable.
///
/// # Errors
/// 403 without `billing.preauth_alerts.configure`.
pub async fn get_preauth_alert_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<PreauthAlertSettings>, AppError> {
    require_permission(&claims, permissions::billing::preauth_alerts::CONFIGURE)?;
    medbrains_kernel::work::<_, AppError, _>(&state.db, Actor::from_claims(&claims), async |tx| {
        Ok(Json(current(tx).await?))
    })
    .await
}

/// `PUT /api/billing/preauth-alert-settings` — save a threshold from 1 to
/// 100, on the audit chain with the old and new values.
///
/// # Errors
/// 403 without `billing.preauth_alerts.configure`; 400 out of range.
pub async fn put_preauth_alert_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdatePreauthAlertSettings>,
) -> Result<Json<PreauthAlertSettings>, AppError> {
    require_permission(&claims, permissions::billing::preauth_alerts::CONFIGURE)?;
    if !(1..=100).contains(&body.threshold_percent) {
        return Err(AppError::BadRequest(
            "billing.preauthAlerts.outOfRange".to_owned(),
        ));
    }
    let actor = Actor::from_claims(&claims);
    medbrains_kernel::work::<_, AppError, _>(&state.db, actor, async |tx| {
        let old = current(tx).await?;
        sqlx::query(
            "INSERT INTO tenant_settings (tenant_id, category, key, value) VALUES ($1, $2, $3, $4) \
             ON CONFLICT (tenant_id, category, key) \
             DO UPDATE SET value = EXCLUDED.value, deleted_at = NULL, updated_at = now()",
        )
        .bind(actor.tenant_id)
        .bind(CATEGORY)
        .bind(KEY)
        .bind(json!(body.threshold_percent))
        .execute(&mut **tx)
        .await?;
        let saved = current(tx).await?;
        let (old_v, new_v) = (json!(old), json!(saved));
        audit(
            tx,
            &AuditEntry {
                tenant_id: actor.tenant_id,
                user_id: Some(actor.user_id),
                action: "update",
                entity_type: "billing_preauth_alert_settings",
                entity_id: None,
                old_values: Some(&old_v),
                new_values: Some(&new_v),
                ip_address: None,
            },
        )
        .await?;
        Ok(Json(saved))
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::read_threshold;
    use serde_json::json;

    #[test]
    fn a_stored_threshold_is_read_as_the_check_reads_it() {
        assert_eq!(read_threshold(None).threshold_percent, None);
        assert!(!read_threshold(None).invalid);
        assert_eq!(
            read_threshold(Some(&json!(90))).threshold_percent,
            Some(90.0)
        );
        assert_eq!(
            read_threshold(Some(&json!("85"))).threshold_percent,
            Some(85.0)
        );
        for bad in [json!(0), json!(101), json!("80%"), json!(true), json!("-5")] {
            let r = read_threshold(Some(&bad));
            assert!(r.invalid && r.threshold_percent.is_none(), "{bad}");
        }
    }
}

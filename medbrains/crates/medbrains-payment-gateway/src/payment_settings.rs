//! The billing screen's own payment settings: the hospital's UPI ID
//! (`payments` / `upi_vpa`, read by the counter QR and the GST invoice) and
//! its payment-link terms (`payments` / `balance_link`, read by
//! [`crate::balance_link::settings::load`]).
//!
//! The `payments` category also holds provider keys, so it is not reachable
//! through the generic settings API (`settings_guard`); this endpoint reads
//! and writes exactly these two keys, validates them, and audits the change.
//! Provider keys have their own write-only endpoint (`online::settings`).

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use medbrains_kernel::audit::AuditEntry;
use medbrains_kernel::{Actor, Claims, Tx, audit, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

/// Setting key of the hospital's UPI ID.
const UPI_KEY: &str = "upi_vpa";
/// Setting key of the payment-link terms.
const LINK_KEY: &str = "balance_link";
/// The largest least-part a hospital may set, in rupees.
const MAX_MIN_PART: f64 = 100_000.0;
/// The longest a payment link may stay open, in days.
const MAX_EXPIRY_DAYS: i64 = 90;
/// Longest UPI ID accepted (NPCI caps the handle well below this).
const MAX_UPI_LEN: usize = 255;

/// What the billing screen shows: the two keys, as stored.
#[derive(Debug, Serialize)]
pub struct PaymentSettings {
    pub upi_vpa: Option<String>,
    /// `None` until saved; the server's defaults apply meanwhile.
    pub balance_link: Option<Value>,
}

/// Payment-link terms as the screen sends them.
#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct LinkTerms {
    pub accept_partial: bool,
    pub min_part_amount: f64,
    pub expiry_days: i64,
    pub reminders: bool,
}

/// A change: only the fields present are written.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdatePaymentSettings {
    /// An empty string clears the UPI ID.
    pub upi_vpa: Option<String>,
    pub balance_link: Option<LinkTerms>,
}

/// Whether `vpa` looks like a UPI ID: `handle@provider`, handle of letters,
/// digits, `.`, `-`, `_`; provider of letters and digits starting with a letter.
fn is_upi_id(vpa: &str) -> bool {
    let Some((handle, provider)) = vpa.split_once('@') else {
        return false;
    };
    vpa.len() <= MAX_UPI_LEN
        && handle.len() >= 2
        && handle
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'-' | b'_'))
        && provider.len() >= 2
        && provider.bytes().all(|b| b.is_ascii_alphanumeric())
        && provider
            .bytes()
            .next()
            .is_some_and(|b| b.is_ascii_alphabetic())
}

/// Refuse link terms outside what the screen and the link code accept.
///
/// # Errors
/// [`AppError::BadRequest`] with a plain message.
fn check_terms(t: &LinkTerms) -> Result<(), AppError> {
    if !(0.0..=MAX_MIN_PART).contains(&t.min_part_amount) {
        return Err(AppError::BadRequest(
            "The least part must be between ₹0 and ₹1,00,000".to_owned(),
        ));
    }
    if !(1..=MAX_EXPIRY_DAYS).contains(&t.expiry_days) {
        return Err(AppError::BadRequest(
            "A payment link stays open 1 to 90 days".to_owned(),
        ));
    }
    Ok(())
}

/// One `payments` setting of the unit of work's tenant.
async fn read(tx: &mut Tx, key: &str) -> Result<Option<Value>, AppError> {
    let tenant = tx.actor().tenant_id;
    Ok(medbrains_kernel::config::setting_in(tx, &tenant, "payments", key).await?)
}

/// Upsert one `payments` setting of the unit of work's tenant.
async fn write(tx: &mut Tx, key: &str, value: &Value) -> Result<(), AppError> {
    let tenant = tx.actor().tenant_id;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) VALUES ($1, 'payments', $2, $3) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = EXCLUDED.value, deleted_at = NULL, updated_at = now()",
    )
    .bind(tenant)
    .bind(key)
    .bind(value)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Both keys, as stored.
async fn current(tx: &mut Tx) -> Result<PaymentSettings, AppError> {
    let upi_vpa = read(tx, UPI_KEY)
        .await?
        .and_then(|v| v.as_str().map(ToOwned::to_owned))
        .filter(|v| !v.is_empty());
    let balance_link = read(tx, LINK_KEY).await?.filter(Value::is_object);
    Ok(PaymentSettings {
        upi_vpa,
        balance_link,
    })
}

/// `GET /api/billing/payment-settings`.
pub async fn get_payment_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<PaymentSettings>, AppError> {
    require_permission(&claims, permissions::billing::payment_settings::VIEW)?;
    medbrains_kernel::work::<_, AppError, _>(&state.db, Actor::from_claims(&claims), async |tx| {
        Ok(Json(current(tx).await?))
    })
    .await
}

/// `PUT /api/billing/payment-settings` — validates, writes only the fields
/// given, and records the change on the audit chain.
pub async fn put_payment_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdatePaymentSettings>,
) -> Result<Json<PaymentSettings>, AppError> {
    require_permission(&claims, permissions::billing::payment_settings::MANAGE)?;
    let upi = body.upi_vpa.as_deref().map(str::trim);
    if let Some(vpa) = upi.filter(|v| !v.is_empty())
        && !is_upi_id(vpa)
    {
        return Err(AppError::BadRequest(
            "Enter a UPI ID like hospital@okaxis".to_owned(),
        ));
    }
    if let Some(terms) = &body.balance_link {
        check_terms(terms)?;
    }
    let actor = Actor::from_claims(&claims);
    medbrains_kernel::work::<_, AppError, _>(&state.db, actor, async |tx| {
        if let Some(vpa) = upi {
            write(tx, UPI_KEY, &json!(Some(vpa).filter(|v| !v.is_empty()))).await?;
        }
        if let Some(terms) = &body.balance_link {
            write(tx, LINK_KEY, &json!(terms)).await?;
        }
        let saved = current(tx).await?;
        let values = json!({ "upi_vpa": saved.upi_vpa, "balance_link": saved.balance_link });
        audit(
            tx,
            &AuditEntry {
                tenant_id: actor.tenant_id,
                user_id: Some(actor.user_id),
                action: "update",
                entity_type: "billing_payment_settings",
                entity_id: None,
                old_values: None,
                new_values: Some(&values),
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
    use super::{LinkTerms, check_terms, is_upi_id};

    #[test]
    fn upi_ids_are_checked_for_shape() {
        assert!(is_upi_id("hospital@okaxis"));
        assert!(is_upi_id("city.hospital-1_x@ybl"));
        for bad in [
            "hospital",
            "@okaxis",
            "h@",
            "a b@okaxis",
            "x@ok-axis",
            "hh@1ok",
        ] {
            assert!(!is_upi_id(bad), "{bad}");
        }
    }

    #[test]
    fn link_terms_stay_within_bounds() {
        let terms = |min, days| LinkTerms {
            accept_partial: true,
            min_part_amount: min,
            expiry_days: days,
            reminders: false,
        };
        assert!(check_terms(&terms(100.0, 7)).is_ok());
        assert!(check_terms(&terms(-1.0, 7)).is_err());
        assert!(check_terms(&terms(100.0, 0)).is_err());
        assert!(check_terms(&terms(100.0, 91)).is_err());
    }
}

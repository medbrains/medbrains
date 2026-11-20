//! The physical consultation's order contract, as NHA's consultation docs
//! (docs.abdm.gov.in/docs/uhi/v1/services/consultation) lay it out:
//!
//! 1. `init` names a slot by its UUID. `on_init` returns the order id (this
//!    transaction's), the quote, and five terms, each `INITIATED`; the slot
//!    is held for 15 minutes ([`hold`]), and let go by itself if no confirm
//!    comes (a lapsed hold simply stops counting against the slot).
//! 2. `confirm` must send the same order id and all five terms `AGREED`
//!    ([`terms_agreed`]), or it is refused with a UHI error.
//! 3. `on_confirm` carries `authorization.type: PIN`, status `GENERATED`,
//!    and the `messaging_support` and `helpline_number` tags.
//!
//! The PIN is the patient's proof at the desk. It exists in clear only in
//! the `on_confirm` sent to the patient's app: the hospital keeps an argon2
//! hash ([`issue_pin`]), the stored order carries no token, the outbox drops
//! the token once the app has taken the answer, and nothing logs it. The
//! desk checks the PIN the patient shows against the hash ([`check_pin`]),
//! five wrong tries at most.
//!
//! - `POST /api/uhi/requests/{id}/check-pin` — the desk's check

use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use super::{
    protocol::{STATE_DOCTOR_NO_SHOW, TAG_SLOT_ID},
    slot_ids::SLOT_HOLD_MINUTES,
    slots::{Slot, timestamp},
};
use crate::{error::AppError, middleware::auth::Claims, state::AppState};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// The five terms of a consultation order, in the docs' order, with what
/// each means at this hospital (paid at the desk, nothing taken online).
pub const TERMS: [(&str, &str); 5] = [
    (
        "Commercial",
        "The fee quoted, for one consultation with the doctor named",
    ),
    (
        "Settlement",
        "Settled with the hospital at the desk, not through the app",
    ),
    (
        "Cancellation",
        "Cancel through the app any time before the consultation starts",
    ),
    (
        "Refund",
        "Nothing is paid through the app, so nothing is refunded through it",
    ),
    ("Payment", "Paid at the hospital when the patient arrives"),
];
const TERMS_INITIATED: &str = "INITIATED";
const TERMS_AGREED: &str = "AGREED";
const AUTH_PIN: &str = "PIN";
const AUTH_GENERATED: &str = "GENERATED";
const TAG_MESSAGING: &str = "@abdm/gov.in/messaging_support";
const TAG_HELPLINE: &str = "@abdm/gov.in/helpline_number";
/// Wrong PINs the desk may try before the booking must be checked by hand.
const MAX_PIN_TRIES: i32 = 5;
const PIN_DIGITS: usize = 4;

/// The five terms `on_init` offers, each `INITIATED`, standing until the
/// slot starts.
pub fn terms(slot: &Slot) -> Value {
    let until = timestamp(slot.date.and_time(slot.start));
    TERMS
        .iter()
        .map(|(kind, says)| {
            json!({ "type": kind,
                "descriptor": { "name": format!("{kind} terms and conditions"), "short_desc": says },
                "reasonRequired": false, "timePeriod": until, "reason": "",
                "termsState": TERMS_INITIATED })
        })
        .collect()
}

/// Whether a confirm agreed to every term: all five types present, each
/// `AGREED`. The error names the first that is not.
///
/// # Errors
/// What the patient's app is told: which term is missing or not agreed.
pub fn terms_agreed(order: &Value) -> Result<(), String> {
    let sent = order.get("terms").and_then(Value::as_array);
    for (kind, _) in TERMS {
        let state = sent
            .and_then(|t| t.iter().find(|t| t["type"].as_str() == Some(kind)))
            .and_then(|t| t["termsState"].as_str());
        match state {
            Some(TERMS_AGREED) => {}
            Some(other) => return Err(format!("the {kind} term is {other}, not AGREED")),
            None => return Err(format!("the {kind} term is missing")),
        }
    }
    Ok(())
}

/// A physical consultation's confirm must name the order `on_init` gave and
/// agree to all five terms; the reason it does not, for the app.
pub fn refuse_order(body: &Value, txn_id: Uuid) -> Option<String> {
    let order = body.pointer("/message/order").unwrap_or(&Value::Null);
    if order.get("id").and_then(Value::as_str) != Some(txn_id.to_string().as_str()) {
        return Some("the order id is not the one on_init gave: send init first".to_owned());
    }
    terms_agreed(order).err()
}

/// Who `init` named as the patient, kept with the hold so the staff screen
/// shows whose slot it is.
#[derive(Debug, Clone, Copy)]
pub struct Holder<'a> {
    pub name: Option<&'a str>,
    pub phone: Option<&'a str>,
    pub abha: Option<&'a str>,
}

/// Hold `slot` for the transaction for [`SLOT_HOLD_MINUTES`], keeping the
/// draft order; a repeated init moves the hold along. Returns when it lapses.
///
/// # Errors
/// A database fault.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn hold(
    tx: &mut Tx<'_>,
    txn_id: Uuid,
    (slot, order): (&Slot, &Value),
    who: Holder<'_>,
) -> Result<DateTime<Utc>, AppError> {
    // allow-raw-sql: by id on the inbound tenant tx; uhi_transactions is FORCE RLS
    let until = sqlx::query_scalar!(
        r#"UPDATE uhi_transactions SET slot_id = $2, state = 'initialised', order_details = $3,
                slot_held_until = now() + make_interval(mins => $4),
                customer_name = $5, customer_phone = $6, customer_abha = $7
          WHERE id = $1 RETURNING slot_held_until AS "until!""#,
        txn_id,
        slot.id,
        order,
        SLOT_HOLD_MINUTES,
        who.name,
        who.phone,
        who.abha,
    )
    .fetch_one(&mut **tx)
    .await?;
    Ok(until)
}

/// A fresh 4-digit PIN for the booking: its argon2 hash is stored and the
/// hold is spent; the PIN itself is returned only to go into `on_confirm`.
///
/// # Errors
/// A database fault, or the hash could not be made.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn issue_pin(tx: &mut Tx<'_>, txn_id: Uuid) -> Result<String, AppError> {
    let pin = format!(
        "{:0width$}",
        rand::random_range(0..10_000_u32),
        width = PIN_DIGITS
    );
    let hash = Argon2::default()
        .hash_password(pin.as_bytes())
        .map_err(|e| AppError::Internal(format!("uhi pin hash: {e}")))?
        .to_string();
    // allow-raw-sql: by id on the inbound tenant tx; uhi_transactions is FORCE RLS
    sqlx::query!(
        "UPDATE uhi_transactions SET pin_hash = $2, pin_failed_attempts = 0, \
                slot_held_until = NULL WHERE id = $1",
        txn_id,
        hash,
    )
    .execute(&mut **tx)
    .await?;
    Ok(pin)
}

/// `authorization` of a confirmed order: a PIN valid on the slot's day.
/// `pin` is `None` in the copy the hospital stores.
pub fn authorization(pin: Option<&str>, day: NaiveDate) -> Value {
    let mut auth = json!({
        "type": AUTH_PIN, "status": AUTH_GENERATED,
        "valid_from": format!("{day}T00:00:00"), "valid_to": format!("{day}T23:59:00"),
    });
    if let Some(pin) = pin {
        auth["token"] = json!(pin);
    }
    auth
}

/// The confirmed fulfilment's tags. Messaging is `false`: an `on_message` is
/// recorded, but nothing at the hospital reads it yet.
pub fn confirm_tags(slot: &Slot, helpline: Option<&str>) -> Value {
    json!({ TAG_SLOT_ID: slot.id, TAG_MESSAGING: "false",
            TAG_HELPLINE: helpline.unwrap_or_default() })
}

/// The number patients ring: the campus's, else the hospital's.
///
/// # Errors
/// A database fault.
#[tracing::instrument(skip_all, fields(tenant_id = %tenant_id))]
pub async fn helpline(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    facility_id: Option<Uuid>,
) -> Result<Option<String>, AppError> {
    // allow-raw-sql: binds tenant_id for tenants and facilities on the caller's tx
    Ok(sqlx::query_scalar!(
        "SELECT COALESCE(NULLIF(f.phone, ''), NULLIF(t.phone, '')) FROM tenants t \
           LEFT JOIN facilities f ON f.id = $2 AND f.tenant_id = t.id WHERE t.id = $1",
        tenant_id,
        facility_id,
    )
    .fetch_optional(&mut **tx)
    .await?
    .flatten())
}

/// An `on_update` from the patient's app: a `DOCTOR_NO_SHOW` is kept, once,
/// for the staff screen. Anything else is only recorded with the message.
///
/// # Errors
/// A database fault.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn record_update(tx: &mut Tx<'_>, txn_id: Uuid, body: &Value) -> Result<(), AppError> {
    let state = body.pointer("/message/order/state").and_then(Value::as_str);
    if state != Some(STATE_DOCTOR_NO_SHOW) {
        return Ok(());
    }
    // allow-raw-sql: by id on the inbound tenant tx; uhi_transactions is FORCE RLS
    sqlx::query!(
        "UPDATE uhi_transactions SET doctor_no_show_at = COALESCE(doctor_no_show_at, now()) \
          WHERE id = $1",
        txn_id,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The PIN the patient shows at the desk.
#[derive(Debug, Deserialize)]
pub struct PinCheck {
    pub pin: String,
}

/// Whether it matched, and how many wrong tries are left.
#[derive(Debug, Serialize)]
pub struct PinResult {
    pub matched: bool,
    pub tries_left: i32,
}

/// `POST /api/uhi/requests/{id}/check-pin` — check the PIN a patient shows
/// against the booking's hash; a match is recorded with who checked it.
///
/// # Errors
/// 400 when it is not four digits; 403 without `uhi.requests.check_pin`; 404
/// for no confirmed booking; 409 when it has no PIN or too many wrong tries.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn check_pin(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<PinCheck>,
) -> Result<Json<PinResult>, AppError> {
    let permit = medbrains_kernel::authz::permit(&claims, permissions::uhi::requests::CHECK_PIN)?;
    let pin = body.pin.trim();
    if pin.len() != PIN_DIGITS || !pin.bytes().all(|b| b.is_ascii_digit()) {
        return Err(AppError::BadRequest("the PIN is four digits".to_owned()));
    }
    let mut tx = medbrains_kernel::tenancy::tenant_tx(&state.db, &permit).await?;
    // allow-raw-sql: filters tenant_id on the permit's tenant_tx; locks the row for the try
    let row = sqlx::query!(
        "SELECT pin_hash, pin_failed_attempts FROM uhi_transactions \
          WHERE id = $1 AND tenant_id = $2 AND state = 'confirmed' AND deleted_at IS NULL \
          FOR UPDATE",
        id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let hash = row
        .pin_hash
        .ok_or_else(|| AppError::Conflict("this booking has no PIN".to_owned()))?;
    if row.pin_failed_attempts >= MAX_PIN_TRIES {
        return Err(AppError::Conflict(
            "too many wrong PINs: check the patient's identity and booking by hand".to_owned(),
        ));
    }
    let matched = pin_matches(&hash, pin)?;
    // allow-raw-sql: the row locked above, same tenant_tx; FORCE RLS
    let failed = sqlx::query_scalar!(
        "UPDATE uhi_transactions SET \
            pin_verified_at = CASE WHEN $2 THEN now() ELSE pin_verified_at END, \
            pin_verified_by = CASE WHEN $2 THEN $3 ELSE pin_verified_by END, \
            pin_failed_attempts = pin_failed_attempts + CASE WHEN $2 THEN 0 ELSE 1 END \
          WHERE id = $1 RETURNING pin_failed_attempts",
        id,
        matched,
        claims.sub,
    )
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(PinResult {
        matched,
        tries_left: (MAX_PIN_TRIES - failed).max(0),
    }))
}

/// Whether `pin` is the one `hash` was made from. A hash that does not parse
/// is a fault, never a "wrong PIN".
fn pin_matches(hash: &str, pin: &str) -> Result<bool, AppError> {
    let parsed =
        PasswordHash::new(hash).map_err(|e| AppError::Internal(format!("uhi pin hash: {e}")))?;
    Ok(Argon2::default()
        .verify_password(pin.as_bytes(), &parsed)
        .is_ok())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::{TERMS, authorization, pin_matches, terms_agreed};
    use argon2::{Argon2, PasswordHasher};
    use chrono::NaiveDate;
    use serde_json::{Value, json};

    fn all(state: &str) -> Value {
        json!({ "terms": TERMS.iter().map(|(k, _)| json!({ "type": k, "termsState": state }))
            .collect::<Vec<_>>() })
    }

    #[test]
    fn confirm_needs_every_term_agreed() {
        assert!(terms_agreed(&all("AGREED")).is_ok());
        assert_eq!(
            terms_agreed(&all("INITIATED")).unwrap_err(),
            "the Commercial term is INITIATED, not AGREED"
        );
        let mut four = all("AGREED");
        four["terms"].as_array_mut().unwrap().pop();
        assert_eq!(
            terms_agreed(&four).unwrap_err(),
            "the Payment term is missing"
        );
        assert!(terms_agreed(&json!({})).is_err());
    }

    #[test]
    fn the_stored_authorization_has_no_token() {
        let day = NaiveDate::from_ymd_opt(2026, 11, 20).unwrap();
        let sent = authorization(Some("0420"), day);
        assert_eq!(
            (sent["type"].as_str(), sent["status"].as_str()),
            (Some("PIN"), Some("GENERATED"))
        );
        assert_eq!(sent["token"], "0420");
        assert!(authorization(None, day).get("token").is_none());
    }

    #[test]
    fn a_pin_matches_its_hash_and_a_bad_hash_is_a_fault() {
        let hash = Argon2::default()
            .hash_password(b"0420")
            .unwrap()
            .to_string();
        assert!(!hash.contains("0420"), "the hash does not carry the PIN");
        assert!(pin_matches(&hash, "0420").unwrap());
        assert!(!pin_matches(&hash, "0421").unwrap());
        assert!(pin_matches("not a hash", "0420").is_err());
    }
}

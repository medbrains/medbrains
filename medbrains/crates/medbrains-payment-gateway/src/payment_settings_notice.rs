//! Telling management when the billing payment settings change (owner
//! decision 2026-11-08). Who may change them is the hospital's choice
//! (`billing.payment_settings.manage` can go to any role), so every change is
//! told to the holders of `billing.payment_settings.notified` (the medical
//! superintendent by default) and to hospital administrators: what changed,
//! who changed it and when.
//!
//! Each holder gets an in-app notification and, when an email is on file, an
//! `email.payment_settings_changed` outbox event, which has a registered
//! handler. There is no push handler, so no push is queued.

use medbrains_core::permissions;
use medbrains_kernel::Tx;
use medbrains_notifications::{NewNotification, create_notification_on, permission_holders};
use medbrains_outbox::{OutboxRow, queue::queue_on};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::payment_settings::PaymentSettings;

/// The outbox event an email of this notice is sent under.
pub const EMAIL_EVENT: &str = "email.payment_settings_changed";
/// Notification kind and title. No action URL: the medical superintendent,
/// the default recipient, cannot open the billing settings page, so the body
/// says everything on its own.
const KIND: &str = "payment_settings_changed";
const TITLE: &str = "Billing payment settings changed";

/// One notification written, to publish live once the work commits.
#[derive(Debug)]
pub struct Told {
    pub id: Uuid,
    pub user_id: Uuid,
    pub body: String,
}

/// A UPI ID for a sentence: the value, or "none".
fn upi_words(upi: Option<&str>) -> &str {
    upi.unwrap_or("none")
}

/// An amount for a sentence: the stored f64 with no ".0" on a whole number
/// ("250", "99.5"), or "not set".
fn rupees(v: &Value) -> String {
    v.as_f64()
        .map_or_else(|| "not set".to_owned(), |n| n.to_string())
}

/// Link terms for a sentence, from the stored JSON (or the defaults).
fn link_words(link: Option<&Value>) -> String {
    let Some(t) = link else {
        return "the defaults".to_owned();
    };
    let yes = |k: &str| {
        if t[k].as_bool() == Some(true) {
            "yes"
        } else {
            "no"
        }
    };
    format!(
        "part payments {}, least part ₹{}, open {} days, reminders {}",
        yes("accept_partial"),
        rupees(&t["min_part_amount"]),
        t["expiry_days"],
        yes("reminders")
    )
}

/// What changed between `before` and `after`, one sentence per setting; empty
/// when the save changed nothing.
#[must_use]
pub fn describe(before: &PaymentSettings, after: &PaymentSettings) -> Vec<String> {
    let mut changes = Vec::new();
    if before.upi_vpa != after.upi_vpa {
        changes.push(format!(
            "UPI ID changed from {} to {}.",
            upi_words(before.upi_vpa.as_deref()),
            upi_words(after.upi_vpa.as_deref())
        ));
    }
    if before.balance_link != after.balance_link {
        changes.push(format!(
            "Payment-link terms changed from {} to {}.",
            link_words(before.balance_link.as_ref()),
            link_words(after.balance_link.as_ref())
        ));
    }
    changes
}

/// The changer's name and the time now in the hospital's timezone (the unit
/// of work sets it), for the notice.
async fn who_and_when(tx: &mut Tx) -> Result<(String, String), AppError> {
    let user = tx.actor().user_id;
    let row: (Option<String>, String) = sqlx::query_as(
        "SELECT (SELECT COALESCE(NULLIF(full_name, ''), username) FROM users WHERE id = $1), \
                to_char(now(), 'DD Mon YYYY, HH24:MI TZ')",
    )
    .bind(user)
    .fetch_one(&mut **tx)
    .await?;
    Ok((row.0.unwrap_or_else(|| "Someone".to_owned()), row.1))
}

/// Tell every holder of the notice permission (except the changer) about
/// `changes`, in the same unit of work as the change itself. Hospital
/// administrators are always among them, a denial notwithstanding. Nobody to
/// tell (a single-admin hospital whose admin made the change) is logged and
/// the change still saves.
///
/// # Errors
/// A database fault, which rolls the change back with it.
pub async fn tell_management(tx: &mut Tx, changes: &[String]) -> Result<Vec<Told>, AppError> {
    let actor = tx.actor();
    let (who, when) = who_and_when(tx).await?;
    let body = format!("{} Changed by {who} on {when}.", changes.join(" "));
    let holders = permission_holders(
        tx,
        actor.tenant_id,
        permissions::billing::payment_settings::NOTIFIED,
        actor.user_id,
    )
    .await?;
    if holders.is_empty() {
        tracing::warn!(
            tenant_id = %actor.tenant_id,
            changed_by = %actor.user_id,
            "payment settings changed with nobody to tell"
        );
    }
    let mut told = Vec::with_capacity(holders.len());
    for user_id in holders {
        let id = create_notification_on(tx, actor.tenant_id, notice(user_id, &body)).await?;
        email(tx, actor.tenant_id, user_id, id, &body).await?;
        told.push(Told {
            id,
            user_id,
            body: body.clone(),
        });
    }
    Ok(told)
}

/// The notification for one holder.
fn notice(user_id: Uuid, body: &str) -> NewNotification<'_> {
    NewNotification {
        user_id,
        kind: KIND,
        title: TITLE,
        body: Some(body),
        category: Some("billing"),
        entity_type: Some("billing_payment_settings"),
        entity_id: None,
        action_url: None,
    }
}

/// Queue the notice by email when the holder has one on file. The key is the
/// notification's id, so it stops the outbox queuing two emails for one
/// notification; a retried request writes a new notification and gets a new
/// key, so it does not dedup across requests.
async fn email(
    tx: &mut Tx,
    tenant_id: Uuid,
    user_id: Uuid,
    notification_id: Uuid,
    body: &str,
) -> Result<(), AppError> {
    let to: Option<String> =
        sqlx::query_scalar("SELECT email FROM users WHERE id = $1 AND COALESCE(email, '') <> ''")
            .bind(user_id)
            .fetch_optional(&mut **tx)
            .await?;
    let Some(to) = to else {
        return Ok(());
    };
    queue_on(
        tx,
        OutboxRow {
            tenant_id,
            aggregate_type: "billing_payment_settings",
            aggregate_id: Some(notification_id),
            event_type: EMAIL_EVENT,
            payload: json!({ "to": to, "subject": TITLE, "text": body }),
            idempotency_key: Some(format!("payment-settings-notice:{notification_id}")),
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("payment settings notice email: {e}")))?;
    Ok(())
}

/// Publish the written notifications to their recipients' open screens; call
/// after the unit of work commits.
pub fn publish(state: &AppState, tenant_id: Uuid, told: &[Told]) {
    for t in told {
        medbrains_notifications::publish_notification(
            state,
            tenant_id,
            t.id,
            &notice(t.user_id, &t.body),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::{PaymentSettings, describe};
    use serde_json::json;

    #[test]
    fn a_change_says_what_it_was_and_no_change_says_nothing() {
        let before = PaymentSettings {
            upi_vpa: Some("old@okaxis".to_owned()),
            balance_link: None,
        };
        let after = PaymentSettings {
            upi_vpa: Some("new@ybl".to_owned()),
            balance_link: Some(json!({ "accept_partial": true, "min_part_amount": 250.0,
                                       "expiry_days": 10, "reminders": false })),
        };
        let said = describe(&before, &after);
        assert_eq!(said.len(), 2);
        assert!(said[0].contains("old@okaxis") && said[0].contains("new@ybl"));
        assert!(said[1].contains("₹250,") && !said[1].contains("250.0"));
        assert!(said[1].contains("10 days"));
        assert!(describe(&after, &after).is_empty());
    }
}

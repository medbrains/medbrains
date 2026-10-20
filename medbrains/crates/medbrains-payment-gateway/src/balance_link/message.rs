//! Sending a link to the patient: SMS or WhatsApp, through the outbox, with
//! the link's real short URL in the message.
//!
//! An SMS about the patient's own bill is a service message and needs no
//! opt-in; WhatsApp needs the patient's own recorded yes
//! (`patient_contact_consents`, DPDP Act 2023 and WhatsApp business policy).

use chrono::{DateTime, Utc};
use medbrains_server_core::error::AppError;
use medbrains_workflow::orchestration::default_pipelines::e164;
use rust_decimal::Decimal;
use serde_json::json;
use uuid::Uuid;

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

pub const SMS_EVENT: &str = "sms.payment_link";
pub const WHATSAPP_EVENT: &str = "whatsapp.payment_link";
/// The approved WhatsApp template: body parameters amount, URL, open-till date.
const WHATSAPP_TEMPLATE: &str = "payment_link";

/// How a link reaches the patient.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Channel {
    Sms,
    Whatsapp,
    /// The cashier copies it; nothing is sent.
    Copy,
    /// The patient asked for it in the portal; nothing is sent.
    Portal,
}

impl Channel {
    /// A channel a desk may pick.
    ///
    /// # Errors
    /// Anything else.
    pub fn for_desk(s: &str) -> Result<Self, AppError> {
        match s {
            "sms" => Ok(Self::Sms),
            "whatsapp" => Ok(Self::Whatsapp),
            "copy" => Ok(Self::Copy),
            _ => Err(AppError::BadRequest(
                "Send the link by sms or whatsapp, or copy it".to_owned(),
            )),
        }
    }

    /// The channel a stored link was sent on.
    #[must_use]
    pub fn stored(s: &str) -> Self {
        match s {
            "sms" => Self::Sms,
            "whatsapp" => Self::Whatsapp,
            "portal" => Self::Portal,
            _ => Self::Copy,
        }
    }

    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Sms => "sms",
            Self::Whatsapp => "whatsapp",
            Self::Copy => "copy",
            Self::Portal => "portal",
        }
    }

    const fn sends(self) -> bool {
        matches!(self, Self::Sms | Self::Whatsapp)
    }
}

/// Where to send, checked before any link is made: the patient's mobile in
/// E.164, and their WhatsApp consent for WhatsApp. `None` for a channel that
/// sends nothing.
///
/// # Errors
/// No dialable mobile, or WhatsApp without consent; a database fault.
pub async fn recipient(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    patient_id: Uuid,
    channel: Channel,
) -> Result<Option<String>, AppError> {
    if !channel.sends() {
        return Ok(None);
    }
    let (phone, whatsapp_ok): (Option<String>, Option<bool>) = sqlx::query_as(
        "SELECT p.phone, \
                (SELECT c.granted FROM patient_contact_consents c \
                  WHERE c.tenant_id = p.tenant_id AND c.patient_id = p.id \
                    AND c.channel = 'whatsapp' ORDER BY c.recorded_at DESC LIMIT 1) \
           FROM patients p WHERE p.tenant_id = $1 AND p.id = $2",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let to = phone.as_deref().and_then(e164).ok_or_else(|| {
        AppError::BadRequest(
            "The patient has no mobile number on file — copy the link instead".to_owned(),
        )
    })?;
    if channel == Channel::Whatsapp && whatsapp_ok != Some(true) {
        return Err(AppError::BadRequest(
            "The patient has not agreed to WhatsApp messages — send it by SMS".to_owned(),
        ));
    }
    Ok(Some(to))
}

/// What the message says.
#[derive(Debug)]
pub struct LinkMessage<'a> {
    pub link_id: Uuid,
    pub patient_id: Uuid,
    pub amount: Decimal,
    pub url: &'a str,
    pub expires_at: DateTime<Utc>,
    pub partial: bool,
}

/// The SMS text, also WhatsApp's fallback.
#[must_use]
pub fn sms_body(m: &LinkMessage<'_>) -> String {
    let till = m.expires_at.format("%d %b");
    let rest = if m.partial {
        " Pay all or part; the rest can be paid at the counter."
    } else {
        ""
    };
    format!(
        "Your hospital bill: pay Rs {} at {} (open till {till}).{rest}",
        m.amount.round_dp(2),
        m.url
    )
}

/// Queue the message: the `n`th send of this link goes out once.
///
/// # Errors
/// A queue fault.
pub async fn queue(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    (channel, to, n): (Channel, &str, i32),
    m: &LinkMessage<'_>,
) -> Result<(), AppError> {
    let body = sms_body(m);
    let (event_type, payload) = match channel {
        Channel::Sms => (
            SMS_EVENT,
            json!({ "to": to, "body": body, "link_id": m.link_id }),
        ),
        Channel::Whatsapp => (
            WHATSAPP_EVENT,
            json!({
                "to": to, "link_id": m.link_id, "patient_id": m.patient_id,
                "template_name": WHATSAPP_TEMPLATE, "language": "en",
                "components": [{ "type": "body", "parameters": [
                    { "type": "text", "text": m.amount.round_dp(2).to_string() },
                    { "type": "text", "text": m.url },
                    { "type": "text", "text": m.expires_at.format("%d %b").to_string() },
                ] }],
                "sms_fallback_body": body,
            }),
        ),
        Channel::Copy | Channel::Portal => return Ok(()),
    };
    medbrains_outbox::queue_in_tx(
        tx,
        medbrains_outbox::OutboxRow {
            tenant_id,
            aggregate_type: "payment_link",
            aggregate_id: Some(m.link_id),
            event_type,
            payload,
            idempotency_key: Some(format!("paylink:{}:{n}", m.link_id)),
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("outbox queue failed: {e}")))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_message_carries_the_url_amount_and_the_part_offer() {
        let m = LinkMessage {
            link_id: Uuid::nil(),
            patient_id: Uuid::nil(),
            amount: Decimal::new(150_050, 2),
            url: "https://rzp.io/i/abc",
            expires_at: DateTime::from_timestamp(1_800_000_000, 0).unwrap_or_default(),
            partial: true,
        };
        let body = sms_body(&m);
        assert!(body.contains("https://rzp.io/i/abc"), "{body}");
        assert!(body.contains("Rs 1500.50"), "{body}");
        assert!(body.contains("part"), "{body}");
        assert!(
            !sms_body(&LinkMessage {
                partial: false,
                ..m
            })
            .contains("part")
        );
    }
}

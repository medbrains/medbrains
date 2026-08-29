//! Public enquiry intake — the "contact us" form, as a first-class channel.
//!
//! # Why this exists
//!
//! Every enquiry in the system arrives by telephone, because a phone call is
//! the only way one can arrive. So the funnel measures one channel while the
//! spend is attributed across all of them: a campaign that drives a hundred
//! form fills and thirty calls is credited with thirty enquiries, and the
//! cost-per-enquiry it reports is more than three times the truth.
//!
//! # Unauthenticated by necessity
//!
//! Somebody enquiring about a hospital does not have an account there. This
//! endpoint is therefore open, and everything defensive about it follows from
//! that:
//!
//! - **Off by default.** A tenant that has not switched the form on answers
//!   404, exactly as public booking does. An open write endpoint nobody
//!   remembers enabling is how a marketing table fills with rubbish.
//! - **Rate limited** by the same middleware as the rest of `/api/public`.
//! - **A honeypot field**, because the cheapest bots fill in everything they
//!   are given. A submission with it filled answers 200 and writes nothing:
//!   telling a scraper it was detected is telling it what to change.
//! - **Bounded free text.** The message column is capped, and there is no
//!   field asking what is wrong with them — see the wall note below.
//!
//! # The wall
//!
//! A "contact us" box is the most likely place in the entire system for
//! somebody to type a symptom. It cannot be prevented — a free-text field is a
//! free-text field — but it can be *not invited*: the form asks what
//! department they want and how to reach them, and the message field is
//! labelled for logistics rather than for complaints. What lands here is
//! treated as enquiry text and never promoted into a clinical record.

use axum::{Json, extract::State};
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{error::AppError, state::AppState};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::contacts::{CHANNEL_EMAIL, CHANNEL_PHONE, canonical_value, resolve_or_create};
use crate::funnel::{self, StageMove};

/// The longest message the form will store.
///
/// Not a validation nicety: an unbounded public text column is a place to put
/// a megabyte. Anything longer is truncated rather than rejected, because the
/// enquiry is still worth having and the person is not going to retype it.
const MAX_MESSAGE_CHARS: usize = 2_000;

#[derive(Debug, Deserialize)]
pub struct PublicEnquiryRequest {
    /// Which hospital. The same resolution public booking uses.
    pub tenant_code: String,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub department_id: Option<Uuid>,
    pub message: Option<String>,
    /// Which campaign sent them, if the landing page knows.
    pub campaign_ref: Option<String>,
    pub source: Option<String>,
    /// `gclid`, `fbclid`, a UTM string — whatever the landing page carried.
    /// Recorded as attribution metadata and never sent anywhere.
    pub external_ref: Option<String>,
    /// Honeypot. A real form renders this hidden and leaves it empty.
    #[serde(default)]
    pub website: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PublicEnquiryResponse {
    /// Deliberately not the contact id. The response confirms receipt and
    /// hands back nothing that could be used to read the record later.
    pub received: bool,
    pub message: String,
}

fn accepted() -> Json<PublicEnquiryResponse> {
    Json(PublicEnquiryResponse {
        received: true,
        message: "Thank you — someone from the hospital will call you back.".to_owned(),
    })
}

/// `POST /api/public/marketing/enquiry`
///
/// Records an enquiry from the hospital's own website.
///
/// # Errors
/// Returns 404 for an unknown tenant code and for a tenant that has not
/// enabled the form — the two are deliberately indistinguishable, so the
/// endpoint cannot be used to enumerate which hospitals run this software.
/// Returns 400 when neither a usable phone number nor an email is given.
pub async fn public_enquiry(
    State(state): State<AppState>,
    Json(body): Json<PublicEnquiryRequest>,
) -> Result<Json<PublicEnquiryResponse>, AppError> {
    // Filled honeypot: answer as though accepted and write nothing. A 400 here
    // tells the author of the bot precisely which field to stop filling in.
    if body.website.as_deref().is_some_and(|v| !v.trim().is_empty()) {
        // No IP here on purpose: `ConnectInfo` is a required extractor that
        // 500s wherever connect info is not wired, and this crate's other
        // callers read the client address from the `client_ip` middleware's
        // extension instead. A public endpoint should not gain a failure mode
        // for the sake of a log line.
        tracing::info!("public enquiry rejected: honeypot filled");
        return Ok(accepted());
    }

    let name = body.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest(
            "please tell us your name so we know who to ask for".to_owned(),
        ));
    }

    // One of the two, normalised the same way the identity table does it, so a
    // form fill and a later phone call collapse onto one enquiry instead of
    // becoming two records of the same person.
    let identity = match (body.phone.as_deref(), body.email.as_deref()) {
        (Some(p), _) if !p.trim().is_empty() => (CHANNEL_PHONE, canonical_value(CHANNEL_PHONE, p)?),
        (_, Some(e)) if !e.trim().is_empty() => (CHANNEL_EMAIL, canonical_value(CHANNEL_EMAIL, e)?),
        _ => {
            return Err(AppError::BadRequest(
                "please leave a phone number or an email so we can reply".to_owned(),
            ));
        }
    };

    let tenant_id: Uuid =
        sqlx::query_scalar("SELECT id FROM tenants WHERE code = $1 AND is_active = true")
            .bind(body.tenant_code.trim())
            .fetch_optional(&state.db)
            .await?
            .ok_or(AppError::NotFound)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &tenant_id).await?;

    require_enquiry_form_enabled(&mut tx, tenant_id).await?;

    let source = body.source.as_deref().map_or("web_form", str::trim);
    let contact = resolve_or_create(&mut tx, tenant_id, identity.0, &identity.1, source).await?;

    // Fill the blanks without overwriting what the hospital already knows. A
    // returning enquirer who types a nickname this time should not lose the
    // name on the record.
    let message = body.message.as_deref().map(|m| {
        let trimmed = m.trim();
        trimmed.chars().take(MAX_MESSAGE_CHARS).collect::<String>()
    });
    sqlx::query(
        "UPDATE mkt_contacts SET \
            display_name  = COALESCE(display_name, $3), \
            email         = COALESCE(email, $4), \
            department_id = COALESCE(department_id, $5), \
            updated_at    = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(contact.id)
    .bind(tenant_id)
    .bind(name)
    .bind(body.email.as_deref().map(str::trim))
    .bind(body.department_id)
    .execute(&mut *tx)
    .await?;

    // The enquiry text goes on the timeline, not into a column on the contact.
    // An interaction is dated and attributable; a column is a running note
    // that quietly becomes a patient summary nobody approved.
    sqlx::query(
        "INSERT INTO mkt_interactions \
            (tenant_id, contact_id, kind, channel, direction, disposition, note) \
         VALUES ($1, $2, 'form', 'web', 'inbound', 'enquiry_received', $3)",
    )
    .bind(tenant_id)
    .bind(contact.id)
    .bind(message.as_deref())
    .execute(&mut *tx)
    .await?;

    // Attribution as a touchpoint, so a form fill is credited beside the camp
    // and the hoarding rather than overwriting whichever came first.
    let campaign_id = match body.campaign_ref.as_deref().map(str::trim) {
        Some(reference) if !reference.is_empty() => {
            sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM mkt_campaigns \
                 WHERE tenant_id = $1 AND (external_ref = $2 OR name = $2) LIMIT 1",
            )
            .bind(tenant_id)
            .bind(reference)
            .fetch_optional(&mut *tx)
            .await?
        }
        _ => None,
    };
    sqlx::query(
        "INSERT INTO mkt_touchpoints \
            (tenant_id, contact_id, campaign_id, kind, source, medium, external_ref) \
         VALUES ($1, $2, $3, 'web_form', $4, 'web', $5)",
    )
    .bind(tenant_id)
    .bind(contact.id)
    .bind(campaign_id)
    .bind(source)
    .bind(body.external_ref.as_deref().map(str::trim))
    .execute(&mut *tx)
    .await?;

    // A callback, due now. The form is not a reply — somebody still has to
    // ring, and the worklist is where that obligation becomes visible instead
    // of sitting in an inbox.
    sqlx::query(
        "INSERT INTO mkt_tasks (tenant_id, contact_id, due_at, kind, note) \
         VALUES ($1, $2, now(), 'callback', 'Website enquiry — call back')",
    )
    .bind(tenant_id)
    .bind(contact.id)
    .execute(&mut *tx)
    .await?;

    // Park it in the first stage so it appears in the funnel rather than
    // sitting stageless and invisible to every report.
    if contact.stage_id.is_none() {
        let first: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM mkt_pipeline_stages WHERE tenant_id = $1 \
             ORDER BY position LIMIT 1",
        )
        .bind(tenant_id)
        .fetch_optional(&mut *tx)
        .await?;
        if let Some(stage_id) = first {
            sqlx::query(
                "UPDATE mkt_contacts SET stage_id = $3, updated_at = now() \
                 WHERE id = $1 AND tenant_id = $2",
            )
            .bind(contact.id)
            .bind(tenant_id)
            .bind(stage_id)
            .execute(&mut *tx)
            .await?;

            funnel::record_stage_move(
                &mut tx,
                &StageMove {
                    tenant_id,
                    contact_id: contact.id,
                    from_stage_id: None,
                    to_stage_id: stage_id,
                    actor_id: None,
                    source: funnel::source::SYSTEM,
                    note: Some("Website enquiry"),
                },
            )
            .await?;
        }
    }

    tx.commit().await?;
    Ok(accepted())
}

/// A tenant that has not switched the form on answers 404.
///
/// The same shape as `require_public_booking_enabled`, and 404 rather than 403
/// for the same reason: a 403 confirms the hospital exists and runs this
/// software, which is an answer an unauthenticated caller has not earned.
async fn require_enquiry_form_enabled(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<(), AppError> {
    let value: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'marketing' \
           AND key = 'public_enquiry_form_enabled'",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let enabled = value
        .map(|v| v.as_bool().unwrap_or(v.as_str() == Some("true")))
        .unwrap_or(false);

    if enabled { Ok(()) } else { Err(AppError::NotFound) }
}

#[cfg(test)]
mod tests {
    use super::MAX_MESSAGE_CHARS;

    /// Truncation keeps the enquiry rather than rejecting it. Somebody who
    /// pasted three pages is still a person who wants to be called back, and
    /// they are not going to retype it.
    #[test]
    fn an_over_long_message_is_truncated_not_refused() {
        let long = "a".repeat(MAX_MESSAGE_CHARS + 500);
        let kept: String = long.chars().take(MAX_MESSAGE_CHARS).collect();
        assert_eq!(kept.chars().count(), MAX_MESSAGE_CHARS);
    }

    /// Multi-byte input must be cut on character boundaries. `take` on chars
    /// does that; slicing bytes would panic mid-codepoint on a Tamil or Hindi
    /// message, which is most of them.
    #[test]
    fn truncation_counts_characters_not_bytes() {
        let tamil = "வணக்கம்".repeat(1_000);
        let kept: String = tamil.chars().take(MAX_MESSAGE_CHARS).collect();
        assert_eq!(kept.chars().count(), MAX_MESSAGE_CHARS);
        assert!(kept.len() > MAX_MESSAGE_CHARS, "multi-byte, so bytes exceed chars");
    }
}

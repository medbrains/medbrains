//! Contact resolution and the enquiry list.
//!
//! Resolution is the load-bearing operation in this module. Every channel —
//! a call, a WhatsApp message, a web form, a walk-in — arrives as an identity
//! and has to land on one contact. Get it wrong in the lenient direction and
//! two people share a record; get it wrong in the strict direction and the
//! returning caller is a stranger every time, which is the failure the
//! product exists to fix.
//!
//! The rule is a single unique index, `(tenant_id, channel, value)`, and a
//! normalised value written once at ingestion. There is no fuzzy matching and
//! no name comparison: a wrong merge in a hospital is worse than a duplicate.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::phone;
use crate::types::{Contact, CreateContactRequest, ListContactsQuery};

/// Channels an identity can arrive on. Phone-shaped ones are normalised.
pub const CHANNEL_PHONE: &str = "phone";
pub const CHANNEL_WHATSAPP: &str = "whatsapp";
pub const CHANNEL_EMAIL: &str = "email";

/// Normalise an identity for storage and lookup.
///
/// The same function must run on the write and the read, or the index stops
/// matching and every returning caller looks new.
///
/// # Errors
/// Returns `AppError::BadRequest` when a phone-shaped value cannot be
/// normalised.
pub fn canonical_value(channel: &str, raw: &str) -> Result<String, AppError> {
    match channel {
        CHANNEL_PHONE | CHANNEL_WHATSAPP => phone::normalise(raw)
            .map_err(|e| AppError::BadRequest(e.message().to_owned())),
        CHANNEL_EMAIL => Ok(raw.trim().to_lowercase()),
        _ => Ok(raw.trim().to_owned()),
    }
}

/// Find the contact behind an identity, if there is one.
///
/// One indexed lookup. This is the query on the screen-pop path, so it stays a
/// single statement against `mkt_contact_identities` — joining the timeline
/// here would make the pop wait for history it renders second.
///
/// # Errors
/// Propagates database errors.
pub async fn find_by_identity(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    channel: &str,
    canonical: &str,
) -> Result<Option<Contact>, AppError> {
    let row = sqlx::query_as::<_, Contact>(
        "SELECT c.id, c.display_name, c.primary_phone, c.email, c.patient_id, \
                c.campaign_id, c.department_id, c.source, c.stage_id, c.assigned_to, \
                c.first_seen_at, c.last_contacted_at, \
                c.consent_call, c.consent_sms, c.consent_whatsapp \
         FROM mkt_contact_identities i \
         JOIN mkt_contacts c ON c.id = i.contact_id AND c.tenant_id = i.tenant_id \
         WHERE i.tenant_id = $1 AND i.channel = $2 AND i.value = $3",
    )
    .bind(tenant_id)
    .bind(channel)
    .bind(canonical)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(row)
}

/// Find the contact behind an identity, creating one if it is unknown.
///
/// Used by every ingestion path. The insert races: two calls from the same
/// number can arrive together, so the identity insert takes
/// `ON CONFLICT DO NOTHING` and the caller re-reads rather than trusting the
/// returned row. A duplicate contact is a data-quality problem; a failed
/// screen-pop is a lost enquiry.
///
/// # Errors
/// Propagates database errors, or `AppError::BadRequest` for an
/// unnormalisable value.
pub async fn resolve_or_create(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    channel: &str,
    raw_value: &str,
    source: &str,
) -> Result<Contact, AppError> {
    let canonical = canonical_value(channel, raw_value)?;

    if let Some(found) = find_by_identity(tx, tenant_id, channel, &canonical).await? {
        return Ok(found);
    }

    let phone_for_contact = matches!(channel, CHANNEL_PHONE | CHANNEL_WHATSAPP)
        .then(|| canonical.clone());
    let email_for_contact = (channel == CHANNEL_EMAIL).then(|| canonical.clone());

    let contact_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mkt_contacts (tenant_id, primary_phone, email, source) \
         VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(tenant_id)
    .bind(phone_for_contact.as_deref())
    .bind(email_for_contact.as_deref())
    .bind(source)
    .fetch_one(&mut **tx)
    .await?;

    sqlx::query(
        "INSERT INTO mkt_contact_identities (tenant_id, contact_id, channel, value, is_primary) \
         VALUES ($1, $2, $3, $4, true) \
         ON CONFLICT (tenant_id, channel, value) DO NOTHING",
    )
    .bind(tenant_id)
    .bind(contact_id)
    .bind(channel)
    .bind(&canonical)
    .execute(&mut **tx)
    .await?;

    // Re-read rather than construct: the conflict branch means the row we hold
    // may not be the row that won.
    find_by_identity(tx, tenant_id, channel, &canonical)
        .await?
        .ok_or_else(|| AppError::Internal("contact resolution lost its own insert".to_owned()))
}

/// `GET /api/marketing/contacts`
///
/// # Errors
/// Returns 403 without `marketing.contacts.list`.
pub async fn list_contacts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListContactsQuery>,
) -> Result<Json<Vec<Contact>>, AppError> {
    require_permission(&claims, permissions::marketing::contacts::LIST)?;
    // No patient filter here, deliberately. These are enquiries, not charts:
    // most rows have no patient_id at all, and scoping the desk's worklist to
    // the caller's own patients would empty it. The tenant boundary and the
    // permission are the control, and the row carries nothing clinical.

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let limit = params.limit.unwrap_or(100).clamp(1, 500);
    let rows = sqlx::query_as::<_, Contact>(
        "SELECT id, display_name, primary_phone, email, patient_id, campaign_id, \
                department_id, source, stage_id, assigned_to, first_seen_at, \
                last_contacted_at, consent_call, consent_sms, consent_whatsapp \
         FROM mkt_contacts \
         WHERE tenant_id = $1 \
           AND ($2::uuid IS NULL OR stage_id = $2) \
           AND ($3::uuid IS NULL OR assigned_to = $3) \
           AND ($4::uuid IS NULL OR campaign_id = $4) \
           AND ($5::text IS NULL OR display_name ILIKE '%' || $5 || '%' \
                                 OR primary_phone ILIKE '%' || $5 || '%') \
         ORDER BY COALESCE(last_contacted_at, first_seen_at) DESC \
         LIMIT $6",
    )
    .bind(claims.tenant_id)
    .bind(params.stage_id)
    .bind(params.assigned_to)
    .bind(params.campaign_id)
    .bind(params.search.as_deref())
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// `GET /api/marketing/contacts/{id}`
///
/// # Errors
/// Returns 403 without `marketing.contacts.view`, 404 if the contact is not in
/// this tenant.
pub async fn get_contact(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Contact>, AppError> {
    require_permission(&claims, permissions::marketing::contacts::VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Contact>(
        "SELECT id, display_name, primary_phone, email, patient_id, campaign_id, \
                department_id, source, stage_id, assigned_to, first_seen_at, \
                last_contacted_at, consent_call, consent_sms, consent_whatsapp \
         FROM mkt_contacts WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/marketing/contacts`
///
/// # Errors
/// Returns 403 without `marketing.contacts.create`, 400 when neither a phone
/// nor an email is given.
pub async fn create_contact(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateContactRequest>,
) -> Result<Json<Contact>, AppError> {
    require_permission(&claims, permissions::marketing::contacts::CREATE)?;

    let (channel, raw) = match (body.phone.as_deref(), body.email.as_deref()) {
        (Some(p), _) if !p.trim().is_empty() => (CHANNEL_PHONE, p),
        (_, Some(e)) if !e.trim().is_empty() => (CHANNEL_EMAIL, e),
        _ => {
            return Err(AppError::BadRequest(
                "an enquiry needs a phone number or an email to be reachable".to_owned(),
            ));
        }
    };

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let source = body.source.as_deref().unwrap_or("manual");
    let contact = resolve_or_create(&mut tx, claims.tenant_id, channel, raw, source).await?;

    // Fill in what the desk typed, without overwriting anything already known.
    // A returning caller who gives a different name this time is not a reason
    // to lose the name the record already had.
    let updated = sqlx::query_as::<_, Contact>(
        "UPDATE mkt_contacts SET \
            display_name  = COALESCE(display_name, $3), \
            email         = COALESCE(email, $4), \
            campaign_id   = COALESCE(campaign_id, $5), \
            department_id = COALESCE(department_id, $6), \
            patient_id    = COALESCE(patient_id, $7), \
            updated_at    = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING id, display_name, primary_phone, email, patient_id, campaign_id, \
                   department_id, source, stage_id, assigned_to, first_seen_at, \
                   last_contacted_at, consent_call, consent_sms, consent_whatsapp",
    )
    .bind(contact.id)
    .bind(claims.tenant_id)
    .bind(body.display_name.as_deref())
    .bind(body.email.as_deref())
    .bind(body.campaign_id)
    .bind(body.department_id)
    .bind(body.patient_id)
    .fetch_one(&mut *tx)
    .await?;

    // Attribution as an appended row, not an overwritten column. The UPDATE
    // above uses COALESCE, which makes `campaign_id` write-once: the campaign
    // that happened to be first through the door keeps the credit forever,
    // and a returning caller who arrives via a second campaign records
    // nothing at all.
    if let Some(campaign_id) = body.campaign_id {
        sqlx::query(
            "INSERT INTO mkt_touchpoints \
                (tenant_id, contact_id, campaign_id, kind, source) \
             VALUES ($1, $2, $3, 'manual', $4)",
        )
        .bind(claims.tenant_id)
        .bind(updated.id)
        .bind(campaign_id)
        .bind(source)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(updated))
}

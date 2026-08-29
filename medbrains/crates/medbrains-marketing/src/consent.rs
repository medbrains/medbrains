//! Consent, suppression, and the gate every send must pass through.
//!
//! # The defect this closes
//!
//! `consent_call`, `consent_sms` and `consent_whatsapp` exist on
//! `mkt_contacts` and appear in this crate only inside SELECT lists — never an
//! UPDATE, never a WHERE. There was no way to record a grant and no way to
//! record a withdrawal. The flags were decoration, and the first send adapter
//! to ship would have been the first code that could consult them, with
//! nothing failing if it forgot.
//!
//! [`resolve_sendable`] exists so that forgetting is not possible: it is the
//! only way to turn a list of contacts into a list of addresses.
//!
//! # Three outcomes, never two
//!
//! A refusal and a fault are different answers and must not wear the same
//! disguise. If a database error resolved to "blocked", a run that failed to
//! read the ledger would skip four thousand people and report a successful
//! send of zero — the outage would be indistinguishable from a tenant whose
//! patients had all opted out. [`Sendability::Unknown`] is therefore a
//! first-class outcome, and the dispatcher must stop rather than treat it as
//! a refusal. See `RFC-AUTHZ-2026-001` §Code.
//!
//! # Why the purpose is coarse
//!
//! Four purposes, fixed by a CHECK constraint: service, appointment, recall,
//! promotional. `recall` may not become `diabetic_retinopathy_recall`. The
//! wall in `0975_marketing.sql` is breached as easily by a vocabulary as by a
//! column, and a purpose string is exactly where somebody would put the
//! reason.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use std::collections::HashMap;
use uuid::Uuid;

use crate::contacts::canonical_value;

/// Traffic classes, mirroring TRAI's categories and the CHECK constraint in
/// `0996_marketing_consent.sql`.
pub mod traffic {
    /// Transactional — a bill, a report, a discharge instruction.
    pub const SERVICE_IMPLICIT: &str = "service_implicit";
    /// Service-explicit — an appointment reminder the patient asked for.
    pub const SERVICE_EXPLICIT: &str = "service_explicit";
    /// Promotional. The only class the frequency cap and quiet hours apply to.
    pub const PROMOTIONAL: &str = "promotional";
}

/// Why one recipient was excluded. A closed, operational vocabulary — none of
/// these is a clinical reason, and none may become one.
pub mod blocked {
    pub const NO_CONSENT: &str = "no_consent";
    pub const WITHDRAWN: &str = "withdrawn";
    pub const SUPPRESSED: &str = "suppressed";
    pub const OVER_CAP: &str = "over_cap";
    pub const NO_ADDRESS: &str = "no_address";
}

/// The answer for one contact.
///
/// `Unknown` is not a refusal and must never be rendered as one. It means the
/// gate could not reach an answer — and a caller that treats it as "blocked"
/// turns an outage into a silent, plausible-looking send of nothing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "outcome", rename_all = "snake_case")]
pub enum Sendability {
    Sendable { address: String },
    Blocked { reason: &'static str },
    Unknown,
}

impl Sendability {
    #[must_use]
    pub const fn is_sendable(&self) -> bool {
        matches!(self, Self::Sendable { .. })
    }
}

/// What the gate returns for a whole cohort.
#[derive(Debug, Default, Serialize)]
pub struct SendableSet {
    pub decisions: HashMap<Uuid, Sendability>,
}

impl SendableSet {
    #[must_use]
    pub fn sendable_count(&self) -> usize {
        self.decisions.values().filter(|d| d.is_sendable()).count()
    }

    /// Recipients the gate could not decide. Non-empty means the run must not
    /// start: sending to only the ones that resolved would quietly drop the
    /// rest, and reporting them as blocked would be a lie about why.
    #[must_use]
    pub fn unresolved(&self) -> Vec<Uuid> {
        self.decisions
            .iter()
            .filter(|(_, d)| matches!(d, Sendability::Unknown))
            .map(|(id, _)| *id)
            .collect()
    }

    /// Excluded recipients grouped by reason, for the compose-screen preview.
    #[must_use]
    pub fn blocked_tally(&self) -> HashMap<&'static str, usize> {
        let mut tally = HashMap::new();
        for decision in self.decisions.values() {
            if let Sendability::Blocked { reason } = decision {
                *tally.entry(*reason).or_insert(0) += 1;
            }
        }
        tally
    }
}

#[derive(Debug, sqlx::FromRow)]
struct GateRow {
    contact_id: Uuid,
    address: Option<String>,
    latest_action: Option<String>,
    suppressed: bool,
}

/// Decides who in a cohort may lawfully be sent to, and why each excluded
/// recipient was excluded.
///
/// One round trip for the whole cohort — `ANY($2)`, never a check per
/// recipient. A cohort of five thousand resolved one at a time is five
/// thousand round trips on a path an operator is watching.
///
/// Service traffic is not subject to the promotional consent check: an
/// appointment reminder is not an offer, and gating it on a marketing opt-in
/// is how a patient stops being told when to come in. It is still subject to
/// an `all`-scope suppression, because that is what a bereaved family asked
/// for.
///
/// # Errors
/// Returns the database error rather than swallowing it. A caller that
/// converts this into "everybody is blocked" has reintroduced the exact defect
/// this module exists to prevent.
pub async fn resolve_sendable(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    contact_ids: &[Uuid],
    ctx: &SendContext<'_>,
) -> Result<SendableSet, AppError> {
    let mut set = SendableSet::default();
    if contact_ids.is_empty() {
        return Ok(set);
    }

    let promotional = ctx.traffic_class == traffic::PROMOTIONAL;

    // `DISTINCT ON` gives the latest ledger row per contact for this channel
    // and purpose; the suppression join is on the identity value, which is why
    // an opt-out survives the contact being deleted and recreated.
    let rows = sqlx::query_as::<_, GateRow>(
        "SELECT c.id AS contact_id, \
                CASE WHEN $3 = 'email' THEN c.email ELSE c.primary_phone END AS address, \
                latest.action AS latest_action, \
                (s.id IS NOT NULL) AS suppressed \
         FROM mkt_contacts c \
         LEFT JOIN LATERAL ( \
             SELECT k.action FROM mkt_consents k \
             WHERE k.tenant_id = c.tenant_id AND k.contact_id = c.id \
               AND k.channel = $3 AND k.purpose = $4 \
             ORDER BY k.occurred_at DESC, k.id DESC LIMIT 1 \
         ) latest ON true \
         LEFT JOIN mkt_suppressions s \
                ON s.tenant_id = c.tenant_id AND s.channel = $3 \
               AND s.value = CASE WHEN $3 = 'email' THEN lower(c.email) \
                                  ELSE c.primary_phone END \
               AND (s.scope = 'all' OR $5::boolean) \
         WHERE c.tenant_id = $1 AND c.id = ANY($2)",
    )
    .bind(tenant_id)
    .bind(contact_ids)
    .bind(ctx.channel)
    .bind(ctx.purpose)
    .bind(promotional)
    .fetch_all(&mut **tx)
    .await?;

    for row in rows {
        set.decisions.insert(row.contact_id, decide(&row, promotional));
    }

    // A contact the query did not return is not a refusal — it is a contact
    // the gate has no answer for. Recording it as `Unknown` keeps the count
    // honest instead of silently shrinking the cohort.
    for id in contact_ids {
        set.decisions.entry(*id).or_insert(Sendability::Unknown);
    }

    Ok(set)
}

/// The decision for one row, given the traffic class.
///
/// Split out so the ordering is testable without a database: suppression
/// outranks consent, and a missing address outranks both — telling somebody
/// they opted out when the real problem is that no number was ever recorded
/// sends the desk looking in the wrong place.
fn decide(row: &GateRow, promotional: bool) -> Sendability {
    let Some(address) = row.address.as_deref().map(str::trim).filter(|a| !a.is_empty()) else {
        return Sendability::Blocked { reason: blocked::NO_ADDRESS };
    };
    if row.suppressed {
        return Sendability::Blocked { reason: blocked::SUPPRESSED };
    }
    if promotional {
        return match row.latest_action.as_deref() {
            Some("granted") => Sendability::Sendable { address: address.to_owned() },
            Some("withdrawn") => Sendability::Blocked { reason: blocked::WITHDRAWN },
            // Never asked. Distinct from withdrawn in the ledger, and the same
            // answer here: silence is not consent under DPDP.
            _ => Sendability::Blocked { reason: blocked::NO_CONSENT },
        };
    }
    // Service traffic. An appointment reminder is not an offer, and gating it
    // on a marketing opt-in is how a patient stops being told when to come in.
    Sendability::Sendable { address: address.to_owned() }
}

/// What is being sent, and under what class.
#[derive(Debug)]
pub struct SendContext<'a> {
    pub channel: &'a str,
    pub purpose: &'a str,
    pub traffic_class: &'a str,
}

// ── Ledger endpoints ─────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ConsentEntry {
    pub id: Uuid,
    pub channel: String,
    pub purpose: String,
    pub action: String,
    pub legal_basis: String,
    pub notice_version: Option<String>,
    pub source: String,
    pub occurred_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RecordConsentRequest {
    pub channel: String,
    pub purpose: String,
    pub source: String,
    pub notice_version: Option<String>,
    pub evidence_ref: Option<String>,
}

/// `GET /api/marketing/contacts/{id}/consent`
///
/// The ledger for one contact, newest first. The history, not a current
/// state: "she agreed in March and withdrew in August" is the answer, and a
/// boolean cannot give it.
///
/// # Errors
/// Returns 403 without `marketing.consent.view`.
pub async fn list_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(contact_id): Path<Uuid>,
) -> Result<Json<Vec<ConsentEntry>>, AppError> {
    require_permission(&claims, permissions::marketing::consent::VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ConsentEntry>(
        "SELECT id, channel, purpose, action, legal_basis, notice_version, \
                source, occurred_at \
         FROM mkt_consents WHERE contact_id = $1 AND tenant_id = $2 \
         ORDER BY occurred_at DESC, id DESC",
    )
    .bind(contact_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/marketing/contacts/{id}/consent`
///
/// Appends a grant. Requires `marketing.consent.capture`, which is separate
/// from editing the enquiry: capture asserts that a notice was shown and a
/// person agreed, and whoever can fix a misspelt name should not thereby be
/// able to manufacture that assertion.
///
/// # Errors
/// Returns 403 without the permission, 404 if the contact is not in this
/// tenant, 400 on an unknown channel or purpose.
pub async fn record_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(contact_id): Path<Uuid>,
    Json(body): Json<RecordConsentRequest>,
) -> Result<Json<ConsentEntry>, AppError> {
    require_permission(&claims, permissions::marketing::consent::CAPTURE)?;
    append(&state, &claims, contact_id, &body, "granted").await
}

/// `POST /api/marketing/contacts/{id}/consent/withdraw`
///
/// Appends a withdrawal. Never an UPDATE: DPDP §6 asks what the consent was at
/// the moment of send, and a flag flipped to false destroys the grant that
/// preceded it.
///
/// # Errors
/// Returns 403 without `marketing.consent.withdraw`, 404 if the contact is not
/// in this tenant.
pub async fn withdraw_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(contact_id): Path<Uuid>,
    Json(body): Json<RecordConsentRequest>,
) -> Result<Json<ConsentEntry>, AppError> {
    require_permission(&claims, permissions::marketing::consent::WITHDRAW)?;
    append(&state, &claims, contact_id, &body, "withdrawn").await
}

async fn append(
    state: &AppState,
    claims: &Claims,
    contact_id: Uuid,
    body: &RecordConsentRequest,
    action: &str,
) -> Result<Json<ConsentEntry>, AppError> {
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let exists: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM mkt_contacts WHERE id = $1 AND tenant_id = $2")
            .bind(contact_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?;
    if exists.is_none() {
        return Err(AppError::NotFound);
    }

    let row = sqlx::query_as::<_, ConsentEntry>(
        "INSERT INTO mkt_consents \
            (tenant_id, contact_id, channel, purpose, action, source, \
             notice_version, evidence_ref, captured_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
         RETURNING id, channel, purpose, action, legal_basis, notice_version, \
                   source, occurred_at",
    )
    .bind(claims.tenant_id)
    .bind(contact_id)
    .bind(body.channel.trim())
    .bind(body.purpose.trim())
    .bind(action)
    .bind(body.source.trim())
    .bind(body.notice_version.as_deref())
    .bind(body.evidence_ref.as_deref())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // The legacy booleans stay, demoted to a cache of the ledger so existing
    // reads keep working. Written in the same transaction, so they cannot
    // disagree with the row that authorises a send.
    let granted = action == "granted";
    sqlx::query(
        "UPDATE mkt_contacts SET \
            consent_call     = CASE WHEN $3 = 'phone'    THEN $4 ELSE consent_call END, \
            consent_sms      = CASE WHEN $3 = 'sms'      THEN $4 ELSE consent_sms END, \
            consent_whatsapp = CASE WHEN $3 = 'whatsapp' THEN $4 ELSE consent_whatsapp END, \
            consent_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(contact_id)
    .bind(claims.tenant_id)
    .bind(body.channel.trim())
    .bind(granted)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Suppression ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Suppression {
    pub id: Uuid,
    pub channel: String,
    pub value: String,
    pub reason: String,
    pub scope: String,
    pub since: chrono::DateTime<chrono::Utc>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddSuppressionRequest {
    pub channel: String,
    pub value: String,
    pub reason: String,
    pub scope: Option<String>,
    pub note: Option<String>,
}

/// `POST /api/marketing/suppressions`
///
/// "Never call this number again", from the front desk.
///
/// Keyed on the normalised identity value rather than a contact id, and it
/// does not cascade. `retention_until` deletes a contact; the next inbound
/// call manufactures a fresh one with `consent_* = false`, which reads as "not
/// yet asked" and is indistinguishable from "asked and refused". An opt-out
/// has to outlive the record it was recorded against.
///
/// # Errors
/// Returns 403 without `marketing.suppression.manage`, 400 on an
/// unnormalisable number.
pub async fn add_suppression(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AddSuppressionRequest>,
) -> Result<Json<Suppression>, AppError> {
    require_permission(&claims, permissions::marketing::SUPPRESSION_MANAGE)?;

    // The same normalisation the identity table uses. A number suppressed as
    // the desk typed it must match the number a provider webhook reports, or
    // the opt-out silently fails to apply.
    let value = canonical_value(&body.channel, &body.value)?;
    let scope = body.scope.as_deref().unwrap_or("promotional");

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Re-suppressing an already-suppressed number is the desk doing its job
    // twice, not an error worth showing somebody.
    let row = sqlx::query_as::<_, Suppression>(
        "INSERT INTO mkt_suppressions \
            (tenant_id, channel, value, reason, scope, note, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         ON CONFLICT (tenant_id, channel, value, scope) DO UPDATE \
             SET reason = EXCLUDED.reason, note = EXCLUDED.note \
         RETURNING id, channel, value, reason, scope, since, note",
    )
    .bind(claims.tenant_id)
    .bind(body.channel.trim())
    .bind(&value)
    .bind(body.reason.trim())
    .bind(scope)
    .bind(body.note.as_deref())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// `GET /api/marketing/suppressions`
///
/// # Errors
/// Returns 403 without `marketing.consent.view`.
pub async fn list_suppressions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Suppression>>, AppError> {
    // Reading the list is a consent read; adding to it is a separate act.
    require_permission(&claims, permissions::marketing::consent::VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Suppression>(
        "SELECT id, channel, value, reason, scope, since, note \
         FROM mkt_suppressions WHERE tenant_id = $1 \
         ORDER BY since DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[cfg(test)]
mod tests {
    use super::{GateRow, Sendability, blocked, decide};
    use uuid::Uuid;

    fn row(address: Option<&str>, action: Option<&str>, suppressed: bool) -> GateRow {
        GateRow {
            contact_id: Uuid::new_v4(),
            address: address.map(str::to_owned),
            latest_action: action.map(str::to_owned),
            suppressed,
        }
    }

    /// Silence is not consent. A contact nobody ever asked is refused for
    /// promotional traffic, and refused for a different stated reason than
    /// somebody who withdrew — the desk needs to know which conversation to
    /// have.
    #[test]
    fn never_asked_is_refused_and_is_not_the_same_as_withdrawn() {
        assert_eq!(
            decide(&row(Some("+919000000001"), None, false), true),
            Sendability::Blocked { reason: blocked::NO_CONSENT }
        );
        assert_eq!(
            decide(&row(Some("+919000000001"), Some("withdrawn"), false), true),
            Sendability::Blocked { reason: blocked::WITHDRAWN }
        );
    }

    #[test]
    fn a_granted_promotional_consent_is_sendable() {
        assert!(decide(&row(Some("+919000000001"), Some("granted"), false), true).is_sendable());
    }

    /// An appointment reminder is not an offer. Gating service traffic on a
    /// marketing opt-in is how a patient stops being told when to come in.
    #[test]
    fn service_traffic_does_not_need_a_promotional_opt_in() {
        assert!(decide(&row(Some("+919000000001"), None, false), false).is_sendable());
    }

    /// Suppression outranks consent, on both traffic classes. Somebody who
    /// said "never contact me again" has not been made contactable by an old
    /// grant sitting further up the ledger.
    #[test]
    fn suppression_beats_an_existing_grant() {
        assert_eq!(
            decide(&row(Some("+919000000001"), Some("granted"), true), true),
            Sendability::Blocked { reason: blocked::SUPPRESSED }
        );
        assert_eq!(
            decide(&row(Some("+919000000001"), Some("granted"), true), false),
            Sendability::Blocked { reason: blocked::SUPPRESSED }
        );
    }

    /// A missing address outranks both, because "she opted out" sends the desk
    /// looking for a conversation that never happened when the real problem is
    /// that nobody ever recorded a number.
    #[test]
    fn a_missing_address_is_reported_as_itself() {
        assert_eq!(
            decide(&row(None, Some("granted"), false), true),
            Sendability::Blocked { reason: blocked::NO_ADDRESS }
        );
        assert_eq!(
            decide(&row(Some("   "), Some("granted"), false), true),
            Sendability::Blocked { reason: blocked::NO_ADDRESS }
        );
    }

    /// The whole point of the module. A fault is not a refusal, and the two
    /// must not be the same value — if `Unknown` compared equal to any
    /// `Blocked`, a caller filtering on "not blocked" would send to contacts
    /// the gate never resolved.
    #[test]
    fn unknown_is_not_a_refusal() {
        assert_ne!(Sendability::Unknown, Sendability::Blocked { reason: blocked::NO_CONSENT });
        assert!(!Sendability::Unknown.is_sendable());
    }
}
